import React, { useDeferredValue, useMemo, useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    Passive: true,
    Active: true,
    Output: false,
    Sensor: false,
    Display: false,
    Other: false,
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const normalizeSearchValue = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0131/g, 'i');

  const normalizedSearchQuery = normalizeSearchValue(deferredSearchQuery);

  const categories = useMemo(
    () => Array.from(new Set(COMPONENT_CATALOG.map((item) => item.category))),
    []
  );

  const filteredByCategory = useMemo(
    () =>
      categories
        .map((category) => {
          const items = COMPONENT_CATALOG.filter((item) => {
            if (item.category !== category) return false;
            if (!normalizedSearchQuery) return true;

            const displayName = getComponentDisplayName(
              language,
              item.type,
              item.name
            );
            const haystack = [
              item.name,
              displayName,
              item.type,
              item.icon,
              getCategoryDisplayName(language, item.category),
            ]
              .map(normalizeSearchValue)
              .join(' ');

            return haystack.includes(normalizedSearchQuery);
          });

          return {
            category,
            items,
          };
        })
        .filter(({ items }) => items.length > 0),
    [categories, language, normalizedSearchQuery]
  );

  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const visibleCategoryCount = filteredByCategory.reduce(
    (total, { items }) => total + items.length,
    0
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
    <div className="palette-scroll">
      <div className="palette-search-wrap">
        <div className="palette-search-label">{t(language, 'searchComponents')}</div>
        <input
          className="palette-search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t(language, 'searchComponentsPlaceholder')}
          aria-label={t(language, 'searchComponents')}
        />
      </div>

      {visibleCategoryCount === 0 && (
        <div className="palette-empty-state">{t(language, 'noComponentsFound')}</div>
      )}

      {filteredByCategory.map(({ category, items }) => {
        const isOpen = hasSearchQuery ? true : (openCategories[category] ?? false);

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
