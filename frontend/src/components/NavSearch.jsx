import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2Icon, ShieldCheckIcon, UserIcon } from 'lucide-react';
import { Avatar } from './Avatar';
import { api } from '../utils/api';
import { getInitials } from '../utils/format';

// Search sellers only — a debounced dropdown hitting /users/search.
export function NavSearch({ onClose, inline = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const rootRef = useRef(null);

  const [sellerQuery, setSellerQuery] = useState('');
  const [sellerResults, setSellerResults] = useState([]);
  const [sellerLoading, setSellerLoading] = useState(false);

  useEffect(() => {
    if (inline) return undefined;
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inline, onClose]);

  useEffect(() => {
    const trimmed = sellerQuery.trim();
    if (!trimmed) {
      setSellerResults([]);
      return;
    }
    let cancelled = false;
    setSellerLoading(true);
    const t = window.setTimeout(() => {
      api
        .searchUsers(trimmed)
        .then((data) => {
          if (!cancelled) setSellerResults(data.users || []);
        })
        .catch(() => {
          if (!cancelled) setSellerResults([]);
        })
        .finally(() => {
          if (!cancelled) setSellerLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [sellerQuery]);

  const handleSellerSelect = (sellerId) => {
    navigate(`/sellers/${sellerId}`);
    onClose();
  };

  return (
    <div
      ref={rootRef}
      className={
      inline ?
      'w-full py-2' :
      'absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] rounded-card border border-ink-700 bg-ink-850 p-4 shadow-xl'}>
      
      <div className="relative">
        <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-dim" />
        <input
          type="search"
          autoFocus={!inline}
          value={sellerQuery}
          onChange={(e) => setSellerQuery(e.target.value)}
          placeholder={t('nav.sellerSearch')}
          aria-label="Search sellers"
          className="w-full rounded-full border border-ink-600 bg-ink-900 py-2.5 pl-10 pr-4 text-sm text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth focus:border-acid focus:outline-none" />
        
      </div>

      {sellerQuery.trim() &&
      <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-ink-700">
          {sellerLoading ?
        <div className="flex items-center justify-center py-6">
              <Loader2Icon className="h-4 w-4 animate-spin text-chalk-dim" />
            </div> :
        sellerResults.length === 0 ?
        <p className="px-3 py-4 text-center text-xs text-chalk-dim">
              {t('nav.noStudentsFound', { query: sellerQuery.trim() })}
            </p> :

        sellerResults.map((seller) =>
        <button
          key={seller.id}
          type="button"
          onClick={() => handleSellerSelect(seller.id)}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 ease-smooth hover:bg-ink-800">
          
              <Avatar initials={getInitials(seller.name)} size="sm" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-chalk">
                <span className="truncate">{seller.name}</span>
                {seller.verified &&
            <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-sky" aria-label={t('card.verifiedStudent')} />
            }
              </span>
              {seller.dorm && <span className="shrink-0 text-xs text-chalk-dim">{seller.dorm}</span>}
            </button>
        )
        }
        </div>
      }
    </div>);

}
