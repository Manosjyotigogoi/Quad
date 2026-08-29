import React from 'react';

const sizeMap = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl'
};

const accentMap = {
  acid: 'bg-acid/15 text-acid',
  grape: 'bg-grape/15 text-grape',
  sky: 'bg-sky/15 text-sky',
  tangerine: 'bg-tangerine/15 text-tangerine'
};

export function Avatar({ initials, size = 'md', accent = 'acid' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ${sizeMap[size]} ${accentMap[accent]}`}>
      
      {initials}
    </span>);

}
