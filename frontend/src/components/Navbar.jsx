import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BellIcon,
  MoonIcon,
  SunIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  XIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from './Logo';
import { NavSearch } from './NavSearch';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

// Link labels are resolved through i18n at render time (via t()) so the
// navbar re-renders in the active language when it changes.
const loggedOutLinkKeys = [
  { labelKey: 'nav.browse', to: '/#feed' },
  { labelKey: 'nav.sell', to: '/#sell' },
  { labelKey: 'nav.profile', to: '/profile' }
];

const loggedInLinkKeys = [
  { labelKey: 'nav.browse', to: '/#feed' },
  { labelKey: 'nav.sell', to: '/#sell' },
  { labelKey: 'nav.messages', to: '/messages' },
  { labelKey: 'nav.orders', to: '/orders' },
  { labelKey: 'nav.profile', to: '/profile' }
];

const adminLink = { labelKey: 'nav.admin', to: '/admin' };

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markRead, remove } = useNotifications();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const baseLinks = user ? loggedInLinkKeys : loggedOutLinkKeys;
  const navLinks = user?.role === 'admin' ? [...baseLinks, adminLink] : baseLinks;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.success(t('nav.loggedOut'));
    navigate('/');
  };

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(next);
    window.localStorage.setItem('quad_lang', next);
    toast.success(next === 'en' ? 'Language: English' : 'भाषा: हिन्दी');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-4 px-5 lg:gap-8 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.labelKey}
              to={link.to}
              className={`text-sm font-medium transition-colors duration-150 ease-smooth hover:text-chalk ${
                pathname === link.to ? 'text-chalk' : 'text-chalk-muted'
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('nav.language')}
            title={i18n.language === 'en' ? 'हिन्दी' : 'English'}
            className="hidden h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors hover:bg-ink-800 hover:text-chalk sm:inline-flex"
          >
            <span className="text-[11px] font-bold tracking-wide">
              {i18n.language === 'en' ? 'अ' : 'EN'}
            </span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.theme') : t('nav.theme')}
            title={t('nav.theme')}
            className="hidden h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors hover:bg-ink-800 hover:text-chalk sm:inline-flex"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-[18px] w-[18px]" />
            ) : (
              <MoonIcon className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* Search */}
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label="Search items or sellers"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors duration-150 ease-smooth hover:bg-ink-800 hover:text-chalk"
            >
              <SearchIcon className="h-[18px] w-[18px]" />
            </button>
            {searchOpen && <NavSearch onClose={() => setSearchOpen(false)} />}
          </div>

          {/* Notifications */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-expanded={notifOpen}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors hover:bg-ink-800 hover:text-chalk"
              >
                <BellIcon className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-tangerine px-1 text-[10px] font-bold text-ink-950">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,360px)] rounded-card border border-ink-700 bg-ink-850 p-2 shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-sm font-semibold text-chalk">{t('notifications.title')}</p>
                    {unreadCount > 0 && (
                      <span className="text-xs text-chalk-dim">{t('nav.unread', { count: unreadCount })}</span>
                    )}
                  </div>
                  <div className="styled-scroll max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-chalk-dim">
                        {t('notifications.empty')}
                      </p>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <div
                          key={n._id}
                          className={`flex items-start gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-800 ${
                            !n.read ? 'bg-ink-800/50' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-chalk">{n.title}</p>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-chalk-muted whitespace-pre-line">{n.body}</p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              {n.link && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(n.link);
                                    setNotifOpen(false);
                                  }}
                                  className="text-xs font-medium text-acid hover:underline"
                                >
                                  {t('notifications.view')}
                                </button>
                              )}
                              {!n.read && (
                                <button
                                  type="button"
                                  onClick={() => markRead(n._id)}
                                  className="text-xs text-chalk-dim hover:text-chalk"
                                >
                                  {t('notifications.markRead')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => remove(n._id)}
                                className="text-xs text-chalk-dim hover:text-rose"
                              >
                                {t('notifications.clear')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart */}
          {user && (
            <Link
              to="/cart"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors duration-150 ease-smooth hover:bg-ink-800 hover:text-chalk"
            >
              <ShoppingCartIcon className="h-[18px] w-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-acid px-1 text-[10px] font-bold text-ink-950">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {/* Login / Logout */}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk sm:block"
            >
              {t('nav.logOut')}
            </button>
          ) : (
            <Link
              to="/signin"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk sm:block"
            >
              {t('nav.logIn')}
            </Link>
          )}

          {/* Post item CTA */}
          <Link
            to={user ? '/listings/new' : '/signup'}
            className="inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.postItem')}</span>
            <span className="sm:hidden">{t('nav.postShort')}</span>
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted transition-colors duration-150 ease-smooth hover:bg-ink-800 hover:text-chalk md:hidden"
          >
            {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav aria-label="Mobile" className="border-t border-ink-700/70 px-5 py-3 md:hidden">
          <NavSearch inline onClose={() => setOpen(false)} />
          {navLinks.map((link) => (
            <Link
              key={link.labelKey}
              to={link.to}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <div className="mt-2 flex items-center gap-2 border-t border-ink-700/70 pt-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted hover:bg-ink-800 hover:text-chalk"
              aria-label={t('nav.theme')}
            >
              {theme === 'dark' ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-chalk-muted hover:bg-ink-800 hover:text-chalk"
              aria-label={t('nav.language')}
              title={i18n.language === 'en' ? 'हिन्दी' : 'English'}
            >
              <span className="text-[11px] font-bold tracking-wide">
                {i18n.language === 'en' ? 'अ' : 'EN'}
              </span>
            </button>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="ml-auto text-sm font-medium text-chalk-muted hover:text-chalk"
              >
                {t('nav.logOut')}
              </button>
            ) : (
              <Link
                to="/signin"
                onClick={() => setOpen(false)}
                className="ml-auto text-sm font-medium text-chalk-muted hover:text-chalk"
              >
                {t('nav.logIn')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
