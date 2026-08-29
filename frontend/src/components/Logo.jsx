import React from 'react';
import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-2.5"
      aria-label="Quad, campus marketplace — home">
      
      <span className="grid h-8 w-8 grid-cols-2 gap-[3px] rounded-lg bg-ink-800 p-[6px] ring-1 ring-ink-600">
        <span className="rounded-sm bg-acid" />
        <span className="rounded-sm bg-ink-500" />
        <span className="rounded-sm bg-ink-500" />
        <span className="rounded-sm bg-acid" />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-chalk">
        Quad
      </span>
    </Link>);

}