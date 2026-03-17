import React, { useState } from 'react';
import { COMPONENT_CATALOG, ComponentType } from '../models/types';
import { useCircuitStore } from '../store/circuitStore';
import {
  getCategoryDisplayName,
  getComponentDisplayName,
  t,
} from '../lib/i18n';

const Palette: React.FC = () => {
  const addComponent = useCircuitStore((s) => s.addComponent);
  const language = useCircuitStore((s) => s.language);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    Passive: true,
    Active: true,
    Output: false,
    Sensor: false,
    Display: false,
    Other: false,
  });

  const categories = Array.from(
    new Set(COMPONENT_CATALOG.map((item) => item.category))
  );

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleDragStart = (event: React.DragEvent, type: ComponentType) => {
    event.dataTransfer.setData('componentType', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = (type: ComponentType) => {
    addComponent(type, 400, 300);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {categories.map((category) => {
        const items = COMPONENT_CATALOG.filter(
          (item) => item.category === category
        );
        const isOpen = openCategories[category] ?? false;

        return (
          <div className="palette-category" key={category}>
            <div
              className="palette-category-header"
              onClick={() => toggleCategory(category)}
            >
              <span>
                {getCategoryDisplayName(language, category)} ({items.length})
              </span>
              <span>{isOpen ? 'v' : '>'}</span>
            </div>

            {isOpen && (
              <div className="palette-category-items">
                {items.map((item) => {
                  const displayName = getComponentDisplayName(
                    language,
                    item.type,
                    item.name
                  );

                  return (
                    <div
                      key={item.type}
                      className="palette-item"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item.type)}
                      onClick={() => handleClick(item.type)}
                      title={`${displayName} - ${t(language, 'clickOrDrag')}`}
                    >
                      <div className="palette-item-icon">{item.icon}</div>
                      <span>{displayName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Palette;
