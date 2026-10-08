"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/site-config";

export function FaqAccordion({ items }: { items: FaqItem[] }): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-forge-800 rounded-lg border border-forge-800 bg-forge-900">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-steel-100 hover:bg-forge-850"
              >
                {item.question}
                <span aria-hidden="true" className={`text-steel-500 transition-transform ${isOpen ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-4 text-sm text-steel-400"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
