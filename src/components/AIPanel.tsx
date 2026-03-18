import React, { useEffect, useRef, useState } from 'react';
import {
  ARDUINO_COMPONENT_ID,
  getArduinoPinGlobal,
  getControllerBoardDefinition,
  getControllerBoardPinSummary,
  inferControllerBoardTypeFromText,
  isArduinoReference,
  type ControllerBoardType,
} from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  getBreadboardHoleGlobal,
  isBreadboardReference,
} from '../models/breadboard';
import {
  AI_PROVIDER_CONFIGS,
  COMPONENT_CATALOG,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  type AIProvider,
  type AIConversation,
  type CircuitComponent,
  type ComponentType,
} from '../models/types';
import { useCircuitStore } from '../store/circuitStore';
import {
  getComponentDisplayName,
  getConversationLocale,
  getDefaultConversationTitle,
  getExamplePrompts,
  t,
} from '../lib/i18n';

type AICircuitItem = {
  ref?: string;
  type: string;
  x: number;
  y: number;
};

type AIWireItem = {
  from: { component: string; pin: string };
  to: { component: string; pin: string };
  color?: string;
};

type ResolvedEndpoint = {
  componentId: string;
  pinId: string;
  x: number;
  y: number;
};

type AIChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ParsedCodeFence = {
  label: string;
  content: string;
};

const DEFAULT_WIRE_COLOR = '#e74c3c';
const MAX_CONVERSATION_TITLE_LENGTH = 42;

const normalizeToken = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

const extractCodeFences = (content: string): ParsedCodeFence[] =>
  Array.from(content.matchAll(/```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g)).map(
    (match) => ({
      label: match[1].trim().toLowerCase(),
      content: match[2].trim(),
    })
  );

const parseJsonArray = <T,>(
  rawContent: string,
  validator: (items: unknown[]) => items is T[]
): T[] | null => {
  try {
    const parsed = JSON.parse(rawContent);
    if (!Array.isArray(parsed) || !validator(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const isCircuitArray = (items: unknown[]): items is AICircuitItem[] =>
  items.every((item) => {
    const candidate = item as Record<string, unknown> | null;
    return (
      !!candidate &&
      typeof candidate.type === 'string' &&
      typeof candidate.x === 'number' &&
      typeof candidate.y === 'number'
    );
  });

const isWireArray = (items: unknown[]): items is AIWireItem[] =>
  items.every((item) => {
    const candidate = item as Record<string, unknown> | null;
    const from = candidate?.from as Record<string, unknown> | undefined;
    const to = candidate?.to as Record<string, unknown> | undefined;
    return (
      !!candidate &&
      !!from &&
      !!to &&
      typeof from.component === 'string' &&
      typeof from.pin === 'string' &&
      typeof to.component === 'string' &&
      typeof to.pin === 'string'
    );
  });

const extractTypedJsonArray = <T,>(
  content: string,
  preferredLabel: string,
  validator: (items: unknown[]) => items is T[]
): T[] | null => {
  const fences = extractCodeFences(content);
  const orderedCandidates = [
    ...fences.filter((fence) => fence.label === preferredLabel),
    ...fences.filter((fence) => fence.label === 'json'),
    ...fences.filter((fence) => !fence.label),
  ];

  for (const candidate of orderedCandidates) {
    const parsed = parseJsonArray(candidate.content, validator);
    if (parsed) return parsed;
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseJsonArray(trimmed, validator);
  }

  return null;
};

const createConversationTitle = (message: string, language: 'en' | 'tr') => {
  const compactMessage = message.replace(/\s+/g, ' ').trim();
  if (!compactMessage) return getDefaultConversationTitle(language);

  return compactMessage.length > MAX_CONVERSATION_TITLE_LENGTH
    ? `${compactMessage.slice(0, MAX_CONVERSATION_TITLE_LENGTH - 3)}...`
    : compactMessage;
};

const formatConversationTime = (value: string, language: 'en' | 'tr') => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(getConversationLocale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getConversationPreview = (
  conversation: AIConversation,
  language: 'en' | 'tr'
) => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (!lastMessage) return t(language, 'noMessagesYet');

  const compactMessage = lastMessage.content.replace(/\s+/g, ' ').trim();
  if (!compactMessage) return t(language, 'emptyMessage');

  return compactMessage.length > 70
    ? `${compactMessage.slice(0, 67)}...`
    : compactMessage;
};

const AIPanel: React.FC = () => {
  const aiConversations = useCircuitStore((s) => s.aiConversations);
  const currentAIConversationId = useCircuitStore((s) => s.currentAIConversationId);
  const aiLoading = useCircuitStore((s) => s.aiLoading);
  const createAIConversation = useCircuitStore((s) => s.createAIConversation);
  const selectAIConversation = useCircuitStore((s) => s.selectAIConversation);
  const deleteAIConversation = useCircuitStore((s) => s.deleteAIConversation);
  const updateAIConversationTitle = useCircuitStore((s) => s.updateAIConversationTitle);
  const addAIMessage = useCircuitStore((s) => s.addAIMessage);
  const setAILoading = useCircuitStore((s) => s.setAILoading);
  const apiKey = useCircuitStore((s) => s.apiKey);
  const setApiKey = useCircuitStore((s) => s.setApiKey);
  const aiProvider = useCircuitStore((s) => s.aiProvider);
  const setAIProvider = useCircuitStore((s) => s.setAIProvider);
  const aiModel = useCircuitStore((s) => s.aiModel);
  const setAIModel = useCircuitStore((s) => s.setAIModel);
  const aiBaseUrl = useCircuitStore((s) => s.aiBaseUrl);
  const setAIBaseUrl = useCircuitStore((s) => s.setAIBaseUrl);
  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const addComponent = useCircuitStore((s) => s.addComponent);
  const addWire = useCircuitStore((s) => s.addWire);
  const setCode = useCircuitStore((s) => s.setCode);
  const boardType = useCircuitStore((s) => s.boardType);
  const boardPosition = useCircuitStore((s) => s.boardPosition);
  const breadboardPosition = useCircuitStore((s) => s.breadboardPosition);
  const setBoardType = useCircuitStore((s) => s.setBoardType);
  const language = useCircuitStore((s) => s.language);

  const examplePrompts = getExamplePrompts(language);
  const providerConfig = AI_PROVIDER_CONFIGS[aiProvider];
  const requiresApiKey = providerConfig.requiresApiKey;
  const currentConversation =
    aiConversations.find(
      (conversation) => conversation.id === currentAIConversationId
    ) ?? null;
  const aiMessages = currentConversation?.messages ?? [];

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(currentAIConversationId === null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentConversation) {
      setShowHistory(true);
    }
  }, [currentConversation]);

  useEffect(() => {
    if (!showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, aiLoading, showHistory]);

  const openConversation = (conversationId: string) => {
    selectAIConversation(conversationId);
    setShowHistory(false);
  };

  const startNewConversation = (prefill?: string) => {
    const title = prefill
      ? createConversationTitle(prefill, language)
      : undefined;
    createAIConversation(title);
    setShowHistory(false);
    setInput(prefill ?? '');
  };

  const handleDeleteConversation = (
    conversationId: string,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.stopPropagation();
    deleteAIConversation(conversationId);

    if (currentAIConversationId === conversationId) {
      setShowHistory(true);
    }
  };

  const handleExampleClick = (prompt: string) => {
    if (!currentConversation) {
      startNewConversation(prompt);
      return;
    }

    setInput(prompt);
  };

  const findComponentPin = (component: CircuitComponent, pinRef: string) => {
    const normalized = normalizeToken(pinRef);
    const exactMatch =
      component.pins.find((pin) => {
        const pinId = normalizeToken(pin.id);
        const pinName = normalizeToken(pin.name);
        return pinId === normalized || pinName === normalized;
      }) ?? null;

    if (exactMatch) return exactMatch;

    const looseMatch =
      component.pins.find((pin) => {
        const pinId = normalizeToken(pin.id);
        const pinName = normalizeToken(pin.name);
        return (
          pinId.includes(normalized) ||
          pinName.includes(normalized) ||
          normalized.includes(pinId)
        );
      }) ?? null;

    return looseMatch;
  };

  const resolveWireEndpoint = (
    endpointRef: { component: string; pin: string },
    createdRefs: Map<string, string>,
    availableComponents: CircuitComponent[],
    activeBoardType: ControllerBoardType
  ): ResolvedEndpoint | null => {
    if (isArduinoReference(endpointRef.component)) {
      const arduinoPin = getArduinoPinGlobal(
        endpointRef.pin,
        activeBoardType,
        boardPosition
      );
      if (!arduinoPin) return null;
      return {
        componentId: ARDUINO_COMPONENT_ID,
        pinId: arduinoPin.pin.id,
        x: arduinoPin.x,
        y: arduinoPin.y,
      };
    }

    if (isBreadboardReference(endpointRef.component)) {
      const breadboardHole = getBreadboardHoleGlobal(
        endpointRef.pin,
        breadboardPosition
      );
      if (!breadboardHole) return null;
      return {
        componentId: BREADBOARD_COMPONENT_ID,
        pinId: breadboardHole.id,
        x: breadboardHole.x,
        y: breadboardHole.y,
      };
    }

    const normalizedComponentRef = normalizeToken(endpointRef.component);
    const mappedId = createdRefs.get(normalizedComponentRef);
    const component = mappedId
      ? availableComponents.find((item) => item.id === mappedId)
      : availableComponents.find(
          (item) =>
            normalizeToken(item.id) === normalizedComponentRef ||
            normalizeToken(item.id.slice(0, 6)) === normalizedComponentRef
        );

    const componentByType =
      component ??
      (() => {
        const typedMatches = availableComponents.filter(
          (item) => normalizeToken(item.type) === normalizedComponentRef
        );
        return typedMatches.length === 1 ? typedMatches[0] : null;
      })();

    const resolvedComponent = componentByType;
    if (!resolvedComponent) return null;

    const pin = findComponentPin(resolvedComponent, endpointRef.pin);
    if (!pin) return null;

    return {
      componentId: resolvedComponent.id,
      pinId: pin.id,
      x: resolvedComponent.x + pin.x,
      y: resolvedComponent.y + pin.y,
    };
  };

  const getBoardPinReference = (activeBoardType: ControllerBoardType) =>
    getControllerBoardDefinition(activeBoardType).pinDefs
      .map((pin) =>
        pin.aliases?.length
          ? `${pin.id} (${pin.aliases.join(', ')})`
          : pin.id
      )
      .join(', ');

  const getCircuitDescription = (
    activeBoardType: ControllerBoardType = boardType
  ) => {
    const activeBoard = getControllerBoardDefinition(activeBoardType);
    if (components.length === 0) {
      return `${t(language, 'circuitEmpty')}
  ${t(language, 'boardLabel')}: ${activeBoard.name}
  ${t(language, 'boardPinsLabel')}: ${getControllerBoardPinSummary(activeBoardType)}`;
    }

    const compList = components
      .map((component) => {
        const info = COMPONENT_CATALOG.find((item) => item.type === component.type);
        const displayName = info
          ? getComponentDisplayName(language, info.type, info.name)
          : component.type;
        const positionLabel = language === 'tr' ? 'konum' : 'position';
        const propertiesLabel = language === 'tr' ? 'ozellikler' : 'properties';

        return `${displayName} (ID: ${component.id.slice(0, 6)}, ${positionLabel}: ${component.x},${component.y}, ${propertiesLabel}: ${JSON.stringify(component.properties)})`;
      })
      .join('\n  ');

    const wireList = wires
      .map((wire) => {
        const startBreadboardHole = getBreadboardHoleGlobal(
          wire.startPinId,
          breadboardPosition
        );
        const endBreadboardHole = getBreadboardHoleGlobal(
          wire.endPinId,
          breadboardPosition
        );
        const startComp = components.find((item) => item.id === wire.startComponentId);
        const endComp = components.find((item) => item.id === wire.endComponentId);
        const startInfo = COMPONENT_CATALOG.find((item) => item.type === startComp?.type);
        const endInfo = COMPONENT_CATALOG.find((item) => item.type === endComp?.type);
        const startLabel = startComp
          ? startInfo
            ? getComponentDisplayName(language, startInfo.type, startInfo.name)
            : startComp.type
          : isArduinoReference(wire.startComponentId) ||
              wire.startComponentId === ARDUINO_COMPONENT_ID
            ? activeBoard.name
            : isBreadboardReference(wire.startComponentId) ||
                wire.startComponentId === BREADBOARD_COMPONENT_ID
              ? 'Breadboard'
              : '?';
        const startPinLabel =
          isBreadboardReference(wire.startComponentId) ||
          wire.startComponentId === BREADBOARD_COMPONENT_ID
            ? startBreadboardHole?.label || wire.startPinId
            : wire.startPinId;
        const endLabel = endComp
          ? endInfo
            ? getComponentDisplayName(language, endInfo.type, endInfo.name)
            : endComp.type
          : isArduinoReference(wire.endComponentId) ||
              wire.endComponentId === ARDUINO_COMPONENT_ID
            ? activeBoard.name
            : isBreadboardReference(wire.endComponentId) ||
                wire.endComponentId === BREADBOARD_COMPONENT_ID
              ? 'Breadboard'
            : '?';
        const endPinLabel =
          isBreadboardReference(wire.endComponentId) ||
          wire.endComponentId === BREADBOARD_COMPONENT_ID
            ? endBreadboardHole?.label || wire.endPinId
            : wire.endPinId;
        return `${startLabel}[${startPinLabel}] -> ${endLabel}[${endPinLabel}] (${wire.color})`;
      })
      .join('\n  ');

    return `${t(language, 'currentCircuit')}
  ${t(language, 'componentsLabel')}:
  ${compList}

  ${t(language, 'wiresLabel')}:
  ${wireList || t(language, 'noWiresYet')}

  ${t(language, 'boardLabel')}:
  ${activeBoard.name}

  ${t(language, 'boardPinsLabel')}:
  ${getControllerBoardPinSummary(activeBoardType)}`;
  };

  const requestAICompletion = async (
    allMessages: AIChatMessage[],
    baseUrl: string,
    model: string
  ) => {
    if (
      (
        window as typeof window & {
          electronAPI?: {
            aiChat?: (payload: unknown) => Promise<{ content: string; error?: string }>;
          };
        }
      ).electronAPI?.aiChat
    ) {
      const result = await (
        window as typeof window & {
          electronAPI: {
            aiChat: (
              payload: unknown
            ) => Promise<{ content: string; error?: string }>;
          };
        }
      ).electronAPI.aiChat({
        baseUrl,
        model,
        messages: allMessages,
        apiKey,
      });

      if (result.error) throw new Error(result.error);
      return result.content;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: allMessages,
        max_tokens: 2500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API error: ${response.status}`
      );
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response received.';
  };

  const applyAssistantResponse = (
    assistantMessage: string,
    createdRefs: Map<string, string>,
    activeBoardType: ControllerBoardType
  ) => {
    let componentsAdded = 0;
    let wiresAdded = 0;
    const snapToBreadboard =
      window.snapToBreadboard ??
      require('../components/CircuitCanvas').snapToBreadboard;

    const circuitItems = extractTypedJsonArray(
      assistantMessage,
      'circuit',
      isCircuitArray
    );
    if (circuitItems) {
      try {
        const validTypes = new Set(
          COMPONENT_CATALOG.map((item) => item.type)
        );

        circuitItems.forEach((item, index) => {
          if (!validTypes.has(item.type as ComponentType)) return;

          const snapped = snapToBreadboard(item.x, item.y, item.type);
          addComponent(item.type as ComponentType, snapped.x, snapped.y);
          componentsAdded += 1;

          const allComponents = useCircuitStore.getState().components;
          const createdComponent = allComponents[allComponents.length - 1];
          if (createdComponent) {
            createdRefs.set(
              normalizeToken(item.ref || `c${index + 1}`),
              createdComponent.id
            );
          }
        });
      } catch {
        // Ignore malformed circuit JSON blocks.
      }
    }

    const wireItems = extractTypedJsonArray(
      assistantMessage,
      'wires',
      isWireArray
    );
    if (wireItems) {
      try {
        const latestComponents = useCircuitStore.getState().components;

        for (const wire of wireItems) {
          const start = resolveWireEndpoint(
            wire.from,
            createdRefs,
            latestComponents,
            activeBoardType
          );
          const end = resolveWireEndpoint(
            wire.to,
            createdRefs,
            latestComponents,
            activeBoardType
          );
          if (!start || !end) continue;
          if (
            start.componentId === end.componentId &&
            start.pinId === end.pinId
          ) {
            continue;
          }

          addWire({
            startComponentId: start.componentId,
            startPinId: start.pinId,
            endComponentId: end.componentId,
            endPinId: end.pinId,
            color: wire.color || DEFAULT_WIRE_COLOR,
            points: [start.x, start.y, end.x, end.y],
          });
          wiresAdded += 1;
        }
      } catch {
        // Ignore malformed wire JSON blocks.
      }
    }

    return {
      componentsAdded,
      wiresAdded,
      hasCircuitBlock: Boolean(circuitItems),
      hasWiresBlock: Boolean(wireItems),
    };
  };

  const buildWireRepairPrompt = (
    createdRefs: Map<string, string>,
    activeBoardType: ControllerBoardType
  ) => {
    const activeBoard = getControllerBoardDefinition(activeBoardType);
    const boardPinReference = getBoardPinReference(activeBoardType);
    const reverseRefs = new Map<string, string>();
    createdRefs.forEach((componentId, ref) => {
      reverseRefs.set(componentId, ref);
    });

    const latestComponents = useCircuitStore.getState().components;
    const componentLines = latestComponents
      .map((component) => {
        const info = COMPONENT_CATALOG.find((item) => item.type === component.type);
        const displayName = info
          ? getComponentDisplayName(language, info.type, info.name)
          : component.type;
        const refLabel =
          reverseRefs.get(component.id) ?? component.id.slice(0, 6);
        const pinsLabel = component.pins
          .map((pin) => `${pin.id} (${pin.name})`)
          .join(', ');

        return `- ${refLabel}: ${displayName}, pins: ${pinsLabel}`;
      })
      .join('\n');

    return language === 'tr'
      ? `Bir onceki yanitinda kullanilabilir kablo JSON blogu olusmadi. Sadece tek bir \`\`\`wires\`\`\` JSON blogu don.

Kurallar:
- Duz yazi, aciklama, kod veya ikinci bir block ekleme.
- Kart component adi "arduino" olabilir.
- Sadece bu kartin gercek pinlerini kullan: ${boardPinReference}
- Mevcut kart: ${activeBoard.name}
- Sadece su component referanslarini kullan:
${componentLines}
- Her wire nesnesi {"from":{"component":"...","pin":"..."},"to":{"component":"...","pin":"..."},"color":"#hex"} formatinda olsun.
- Bir onceki yanittaki devre ve kod ile uyumlu baglantilari ver.`
      : `Your previous answer did not produce a usable wire JSON block. Return only one \`\`\`wires\`\`\` JSON block.

Rules:
- Do not include prose, explanations, code, or a second block.
- You may use "arduino" as the board component name.
- Use only real pins exposed by this board: ${boardPinReference}
- Current board: ${activeBoard.name}
- Use only these component references:
${componentLines}
- Every wire item must use {"from":{"component":"...","pin":"..."},"to":{"component":"...","pin":"..."},"color":"#hex"}.
- Make the wiring consistent with your previous circuit and code.`;
  };

  const sendMessage = async () => {
    if (!input.trim() || aiLoading) return;
    if (requiresApiKey && !apiKey.trim()) {
      setShowSettings(true);
      return;
    }

    const userMessage = input.trim();
    const existingMessages = currentConversation?.messages ?? [];
    const conversationId =
      currentConversation?.id ??
      createAIConversation(createConversationTitle(userMessage, language));

    if (currentConversation && existingMessages.length === 0) {
      updateAIConversationTitle(
        conversationId,
        createConversationTitle(userMessage, language)
      );
    }

    setShowHistory(false);
    setInput('');
    addAIMessage(conversationId, { role: 'user', content: userMessage });
    setAILoading(true);

    try {
      const inferredBoardType = inferControllerBoardTypeFromText(userMessage);
      const activeBoardType = inferredBoardType ?? boardType;
      if (activeBoardType !== boardType) {
        setBoardType(activeBoardType);
      }

      const activeBoard = getControllerBoardDefinition(activeBoardType);
      const boardPinReference = getBoardPinReference(activeBoardType);
      const circuitContext = getCircuitDescription(activeBoardType);
      const componentTypes = COMPONENT_CATALOG.map(
        (item) =>
          `${item.type} (${getComponentDisplayName(language, item.type, item.name)})`
      ).join(', ');
      const systemPrompt =
        language === 'tr'
          ? `Sen bir elektronik devre asistanisin. ${activeBoard.name} ve breadboard tabanli devreler konusunda uzmansin.

Gorevlerin:
1. Kullanicinin istedigi devreyi kur.
2. Yeni bilesenler gerekiyorsa bunlari JSON olarak ver.
3. Kablo baglantilarini JSON olarak ver.
4. Arduino kodunu gerekiyorsa \`\`\`arduino ... \`\`\` blogunda ver.
5. Aciklamalari Turkce yaz.

Mevcut devre durumu:
${circuitContext}

Desteklenen bilesen tipleri: ${componentTypes}

Kurallar:
- Yeni bilesenleri mutlaka \`\`\`circuit ... \`\`\` blogunda dizi olarak ver.
- Her yeni bilesen icin benzersiz bir ref ver. Ornek: led1, res1, button1.
- Kablolari mutlaka \`\`\`wires ... \`\`\` blogunda dizi olarak ver.
- \`\`\`wires\`\`\` blogu olmadan yanitin eksik sayilir.
- Kablo endpoint formati:
  {"from":{"component":"arduino","pin":"D13"},"to":{"component":"led1","pin":"anode"},"color":"#e74c3c"}
- Kart component adi olarak sadece "arduino" kullan.
- Mevcut kart: ${activeBoard.name}
- Kart pinleri icin su isimleri kullan: ${getControllerBoardPinSummary(activeBoardType)}.
- Yalnizca kartta gercekten bulunan pinleri kullan. Gecerli pin/ad varyasyonlari: ${boardPinReference}.
- Bilesen pinleri icin bilesenin gercek pin id veya adini kullan.
- x ve y koordinatlari breadboard ustundeki birakma konumudur. Bilesenleri ust uste bindirme.
- Servo devrelerinde servo, 5V/VCC, GND ve tek bir PWM/dijital sinyal pini kullan; kodda acikca Servo.attach(...) ve Servo.write(...) veya Servo.writeMicroseconds(...) yaz.
- DC motor devrelerinde simule edilmesi kolay topolojileri tercih et: dogrudan dc-motor + PWM/dijital pin veya l298n-driver + dc-motor. Gereksiz transistorlu topolojilerden kacin.

Ornek bilesen blogu:
\`\`\`circuit
[
  {"ref":"led1","type":"led","x":220,"y":280},
  {"ref":"res1","type":"resistor","x":180,"y":280}
]
\`\`\`

Ornek kablo blogu:
\`\`\`wires
[
  {"from":{"component":"arduino","pin":"D13"},"to":{"component":"res1","pin":"pin1"},"color":"#e74c3c"},
  {"from":{"component":"res1","pin":"pin2"},"to":{"component":"led1","pin":"anode"},"color":"#f1c40f"},
  {"from":{"component":"led1","pin":"cathode"},"to":{"component":"arduino","pin":"GND"},"color":"#2c3e50"}
]
\`\`\`

- Eger kod veriyorsan \`\`\`arduino ... \`\`\` blogu kullan.
- Metin aciklamanda baglantilarin ne yaptigini da kisaca anlat.`
          : `You are an electronics circuit assistant. You are an expert in ${activeBoard.name} and breadboard-based circuits.

Your tasks:
1. Build the circuit requested by the user.
2. If new components are needed, provide them as JSON.
3. Provide wire connections as JSON.
4. If code is needed, return it inside an \`\`\`arduino ... \`\`\` block.
5. Write explanations in English.

Current circuit state:
${circuitContext}

Supported component types: ${componentTypes}

Rules:
- Always return new components inside a \`\`\`circuit ... \`\`\` array block.
- Give every new component a unique ref. Example: led1, res1, button1.
- Always return wires inside a \`\`\`wires ... \`\`\` array block.
- Your answer is incomplete if the \`\`\`wires\`\`\` block is missing.
- Wire endpoint format:
  {"from":{"component":"arduino","pin":"D13"},"to":{"component":"led1","pin":"anode"},"color":"#e74c3c"}
- Use only "arduino" as the board component name.
- Current board: ${activeBoard.name}
- Use these board pin names: ${getControllerBoardPinSummary(activeBoardType)}.
- Use only pins that actually exist on this board. Valid pin name variants are: ${boardPinReference}.
- For component pins, use the real pin id or pin name.
- x and y coordinates are drop positions on the breadboard. Do not overlap components.
- For servo circuits, prefer a direct servo + 5V/VCC + GND + one PWM/digital signal pin topology, and write explicit Servo.attach(...) plus Servo.write(...) or Servo.writeMicroseconds(...) code.
- For DC motor circuits, prefer simulation-friendly topologies: direct dc-motor + PWM/digital control or l298n-driver + dc-motor. Avoid unnecessary transistor-only topologies.

Example component block:
\`\`\`circuit
[
  {"ref":"led1","type":"led","x":220,"y":280},
  {"ref":"res1","type":"resistor","x":180,"y":280}
]
\`\`\`

Example wire block:
\`\`\`wires
[
  {"from":{"component":"arduino","pin":"D13"},"to":{"component":"res1","pin":"pin1"},"color":"#e74c3c"},
  {"from":{"component":"res1","pin":"pin2"},"to":{"component":"led1","pin":"anode"},"color":"#f1c40f"},
  {"from":{"component":"led1","pin":"cathode"},"to":{"component":"arduino","pin":"GND"},"color":"#2c3e50"}
]
\`\`\`

- If you provide code, use an \`\`\`arduino ... \`\`\` block.
- Briefly explain what the connections do in your response.`;

      const baseUrl = aiBaseUrl.trim() || providerConfig.baseUrl || DEFAULT_AI_BASE_URL;
      const model = aiModel.trim() || providerConfig.model || DEFAULT_AI_MODEL;
      const allMessages: AIChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...existingMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })) as AIChatMessage[],
        { role: 'user', content: userMessage },
      ];

      const assistantMessage = await requestAICompletion(
        allMessages,
        baseUrl,
        model
      );

      addAIMessage(conversationId, {
        role: 'assistant',
        content: assistantMessage,
      });

      const codeMatch = assistantMessage.match(/```(?:arduino|cpp|c)\n([\s\S]*?)```/);
      if (codeMatch) {
        setCode(codeMatch[1].trim());
      }

      const createdRefs = new Map<string, string>();
      const applyResult = applyAssistantResponse(
        assistantMessage,
        createdRefs,
        activeBoardType
      );

      if (
        (applyResult.hasCircuitBlock || codeMatch || applyResult.hasWiresBlock) &&
        applyResult.wiresAdded === 0
      ) {
        const wireRepairMessage = await requestAICompletion(
          [
            ...allMessages,
            { role: 'assistant', content: assistantMessage },
            {
              role: 'user',
              content: buildWireRepairPrompt(createdRefs, activeBoardType),
            },
          ] as AIChatMessage[],
          baseUrl,
          model
        );
        const repairResult = applyAssistantResponse(
          wireRepairMessage,
          createdRefs,
          activeBoardType
        );
        if (repairResult.hasWiresBlock) {
          addAIMessage(conversationId, {
            role: 'assistant',
            content: wireRepairMessage,
          });
        }
      }
    } catch (error: any) {
      addAIMessage(conversationId, {
        role: 'assistant',
        content: `${t(language, 'errorPrefix')}: ${error.message || 'Unknown error'}`,
      });
    } finally {
      setAILoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleProviderChange = (nextProvider: AIProvider) => {
    const previousConfig = AI_PROVIDER_CONFIGS[aiProvider];
    const nextConfig = AI_PROVIDER_CONFIGS[nextProvider];

    setAIProvider(nextProvider);

    if (!aiBaseUrl.trim() || aiBaseUrl.trim() === previousConfig.baseUrl) {
      setAIBaseUrl(nextConfig.baseUrl);
    }

    if (!aiModel.trim() || aiModel.trim() === previousConfig.model) {
      setAIModel(nextConfig.model);
    }
  };

  if (showSettings) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header">
          <div className="ai-panel-title-wrap">
            <div className="ai-panel-title">{t(language, 'aiSettingsTitle')}</div>
            <div className="ai-panel-subtitle">{t(language, 'aiSettingsSubtitle')}</div>
          </div>
          <button
            className="toolbar-btn ai-header-btn"
            onClick={() => setShowSettings(false)}
            type="button"
          >
            {t(language, 'back')}
          </button>
        </div>

        <div className="properties-content">
          <div className="property-group">
            <div className="property-group-title">{t(language, 'provider')}</div>
            <select
              className="property-input"
              style={{ width: '100%', marginBottom: 8 }}
              value={aiProvider}
              onChange={(event) =>
                handleProviderChange(event.target.value as AIProvider)
              }
            >
              {Object.entries(AI_PROVIDER_CONFIGS).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            <div className="property-group-title" style={{ marginTop: 8 }}>
              {t(language, 'apiKey')}
            </div>
            <input
              className="property-input"
              style={{ width: '100%', marginBottom: 8 }}
              type="password"
              placeholder={providerConfig.apiKeyPlaceholder}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />

            <div className="property-group-title" style={{ marginTop: 8 }}>
              {t(language, 'model')}
            </div>
            <input
              className="property-input"
              style={{ width: '100%', marginBottom: 8 }}
              type="text"
              placeholder={providerConfig.model || DEFAULT_AI_MODEL}
              value={aiModel}
              onChange={(event) => setAIModel(event.target.value)}
            />

            <div className="property-group-title" style={{ marginTop: 8 }}>
              {t(language, 'baseUrl')}
            </div>
            <input
              className="property-input"
              style={{ width: '100%', marginBottom: 8 }}
              type="text"
              placeholder={providerConfig.baseUrl || DEFAULT_AI_BASE_URL}
              value={aiBaseUrl}
              onChange={(event) => setAIBaseUrl(event.target.value)}
            />

            <p
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              {t(language, 'providerHelp', {
                provider: providerConfig.label,
                model: providerConfig.model || DEFAULT_AI_MODEL,
              })}
            </p>
            <button
              className="toolbar-btn success"
              style={{ width: '100%' }}
              onClick={() => setShowSettings(false)}
              disabled={requiresApiKey && !apiKey.trim()}
              type="button"
            >
              {t(language, 'saveAndContinue')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title-wrap">
          <div className="ai-panel-title">
            {showHistory
              ? t(language, 'aiHistory')
              : currentConversation?.title || getDefaultConversationTitle(language)}
          </div>
          <div className="ai-panel-subtitle">
            {showHistory
              ? t(language, 'chats', { count: aiConversations.length })
              : currentConversation
                ? formatConversationTime(currentConversation.updatedAt, language)
                : t(language, 'newChat')}
          </div>
        </div>

        <div className="ai-panel-actions">
          {!showHistory && (
            <button
              className="toolbar-btn ai-header-btn"
              onClick={() => setShowHistory(true)}
              type="button"
            >
              {t(language, 'menu')}
            </button>
          )}
          <button
            className="toolbar-btn ai-header-btn"
            onClick={() => setShowSettings(true)}
            type="button"
            title={t(language, 'apiSettings')}
          >
            {t(language, 'settings')}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="ai-history">
          <button
            className="ai-history-new"
            onClick={() => startNewConversation()}
            type="button"
          >
            + {t(language, 'newChat')}
          </button>

          {aiConversations.length === 0 ? (
            <div className="ai-history-empty">
              <p className="ai-history-empty-title">{t(language, 'historyEmptyTitle')}</p>
              <p className="ai-history-empty-text">{t(language, 'historyEmptyText')}</p>
              <div className="ai-suggestion-list">
                {examplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="ai-suggestion-btn"
                    onClick={() => handleExampleClick(prompt)}
                    type="button"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-history-list">
              {aiConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`ai-history-item ${
                    conversation.id === currentAIConversationId ? 'active' : ''
                  }`}
                >
                  <button
                    className="ai-history-open"
                    onClick={() => openConversation(conversation.id)}
                    type="button"
                  >
                    <div className="ai-history-item-title">{conversation.title}</div>
                    <div className="ai-history-item-preview">
                      {getConversationPreview(conversation, language)}
                    </div>
                    <div className="ai-history-item-time">
                      {formatConversationTime(conversation.updatedAt, language)}
                    </div>
                  </button>
                  <button
                    className="ai-history-delete"
                    onClick={(event) =>
                      handleDeleteConversation(conversation.id, event)
                    }
                    type="button"
                    title={t(language, 'deleteConversation')}
                  >
                    {t(language, 'deleteTool')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="ai-messages">
            {aiMessages.length === 0 && (
              <div className="ai-empty-chat">
                <p className="ai-empty-chat-title">{t(language, 'aiAssistantTitle')}</p>
                <p className="ai-empty-chat-text">{t(language, 'aiAssistantIntro')}</p>
                <div className="ai-suggestion-list">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="ai-suggestion-btn"
                      onClick={() => handleExampleClick(prompt)}
                      type="button"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiMessages.map((message, index) => (
              <div
                key={`${currentConversation?.id || 'conversation'}-${index}`}
                className={`ai-message ${message.role}`}
              >
                <pre
                  style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}
                >
                  {message.content}
                </pre>
              </div>
            ))}

            {aiLoading && (
              <div className="ai-message assistant" style={{ opacity: 0.6 }}>
                {t(language, 'thinking')}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            <textarea
              className="ai-input"
              rows={2}
              placeholder={t(language, 'requestPlaceholder')}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={aiLoading}
            />
            <div className="ai-input-actions">
              <button
                className="ai-send-btn"
                onClick={sendMessage}
                disabled={aiLoading || !input.trim()}
                type="button"
              >
                {t(language, 'send')}
              </button>
              {currentConversation && (
                <button
                  className="toolbar-btn danger"
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={(event) =>
                    handleDeleteConversation(currentConversation.id, event)
                  }
                  disabled={aiLoading}
                  type="button"
                >
                  {t(language, 'deleteTool')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIPanel;
