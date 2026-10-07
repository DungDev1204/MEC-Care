import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react';

const choices = [
  { value: 'name', label: 'Tên A–Z' },
  { value: 'recent', label: 'Cập nhật mới nhất' },
  { value: 'contact', label: 'Lâu chưa liên hệ' },
] as const;
export type CustomerSort = typeof choices[number]['value'];

export function SortMenu({ value, onChange }: { value: CustomerSort; onChange: (value: CustomerSort) => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const selected = choices.findIndex(choice => choice.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open) return;
    const align = () => {
      const bounds = trigger.current!.getBoundingClientRect();
      const width = Math.min(240, document.documentElement.clientWidth - 32);
      const height = 146;
      const below = window.innerHeight - bounds.bottom - 16;
      const top = below >= height || bounds.top < height + 16 ? bounds.bottom + 8 : bounds.top - height - 8;
      setPosition({ top, width, left: Math.max(16, Math.min(bounds.left, document.documentElement.clientWidth - width - 16)), maxHeight: Math.max(44, window.innerHeight - top - 16) });
    };
    align();
    window.addEventListener('resize', align);
    window.addEventListener('scroll', align, true);
    return () => { window.removeEventListener('resize', align); window.removeEventListener('scroll', align, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function choose(index: number) { onChange(choices[index].value); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setActive(open ? (active + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length : selected); setOpen(true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setActive(event.key === 'Home' ? 0 : choices.length - 1); setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (open) choose(active); else { setActive(selected); setOpen(true); }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true });
    } else if (event.key === 'Tab') setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const index = choices.findIndex(choice => choice.label.toLocaleLowerCase('vi').startsWith(event.key.toLocaleLowerCase('vi')));
      if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
    }
  }

  return <div className="sort-control">
    <button ref={trigger} type="button" role="combobox" className={`sort-trigger ${open ? 'open' : ''}`} aria-label="Sắp xếp khách hàng" aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-controls={open ? id : undefined} aria-expanded={open} aria-activedescendant={open ? `${id}-${active}` : undefined} onKeyDown={keyboard} onClick={() => { setActive(selected); setOpen(v => !v); }}>
      <ArrowDownUp size={16}/><span id={`${id}-value`}>{choices[selected].label}</span><ChevronDown size={15} className="sort-chevron"/>
    </button>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label="Kiểu sắp xếp khách hàng" className="sort-menu" style={position} onKeyDown={keyboard}>
      {choices.map((choice, index) => <button type="button" role="option" id={`${id}-${index}`} tabIndex={-1} aria-selected={value === choice.value} className={`sort-option ${active === index ? 'active' : ''}`} key={choice.value} onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{choice.label}</span>{value === choice.value && <Check size={16}/>}
      </button>)}
    </div>, document.body)}
  </div>;
}
