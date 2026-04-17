"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getCachedDeveloperBlocks, setCachedDeveloperBlocks } from "@/components/home/admin-block-cache";
import { useCurrentLocale, useDictionary } from "@/components/providers/dictionary-provider";
import { developerUnblockUserAction } from "@/lib/admin/actions";
import { getDeveloperBlockEntries } from "@/lib/admin/blocks";
import { initialDeleteAccountFormState } from "@/lib/auth/action-state";
import { deleteAccountAction, logoutAction } from "@/lib/auth/actions";
import { getUiCopy } from "@/lib/i18n/ui-copy";
import { updateLastSeenVisibilityAction } from "@/lib/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DeveloperBlockEntry } from "@/types/admin";
import type { UserProfile } from "@/types/profile";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ThemeMode = "theme-light" | "theme-dark" | "theme-soft" | "theme-classic";
type SettingsSubview = "settings" | "admin";

const THEME_STORAGE_KEY = "talkbridge-theme";
const DEVELOPER_EMAIL = "yhjxlrj@gmail.com";

function applyTheme(theme: ThemeMode) {
  document.documentElement.className = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function HomeSettingsPanel({
  currentUserEmail,
  isVisible = false,
  onAdminSubviewChange,
  onProfileUpdated,
  profile
}: {
  currentUserEmail: string;
  isVisible?: boolean;
  onAdminSubviewChange?: (isAdminSubview: boolean) => void;
  profile: UserProfile | null;
  onProfileUpdated?: (profile: UserProfile) => void;
}) {
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const copy = getUiCopy(locale);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteAccountAction,
    initialDeleteAccountFormState
  );
  const deleteError = deleteState?.error;
  const [theme, setTheme] = useState<ThemeMode>("theme-soft");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isLastSeenPending, startLastSeenTransition] = useTransition();
  const [isAdminUnblockPending, startAdminUnblockTransition] = useTransition();
  const [showLastSeen, setShowLastSeen] = useState(profile?.showLastSeen ?? true);
  const [lastSeenError, setLastSeenError] = useState<string | null>(null);
  const [activeSubview, setActiveSubview] = useState<SettingsSubview>("settings");
  const [adminBlocks, setAdminBlocks] = useState<DeveloperBlockEntry[] | null>(() => {
    if (!profile?.id) {
      return null;
    }

    return getCachedDeveloperBlocks(profile.id)?.entries ?? null;
  });
  const [isAdminBlocksLoading, setIsAdminBlocksLoading] = useState(() => {
    if (!profile?.id) {
      return false;
    }

    return !getCachedDeveloperBlocks(profile.id);
  });
  const [isAdminBlocksRefreshing, setIsAdminBlocksRefreshing] = useState(false);
  const [adminBlocksError, setAdminBlocksError] = useState<string | null>(null);
  const [pendingAdminBlockId, setPendingAdminBlockId] = useState<string | null>(null);
  const adminBlocksFetchPromiseRef = useRef<Promise<DeveloperBlockEntry[]> | null>(null);
  const isDeveloperMode = currentUserEmail.trim().toLowerCase() === DEVELOPER_EMAIL;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const nextTheme =
      savedTheme === "theme-dark" ||
      savedTheme === "theme-soft" ||
      savedTheme === "theme-light" ||
      savedTheme === "theme-classic"
        ? savedTheme
        : "theme-soft";

    setTheme(nextTheme);
    document.documentElement.className = nextTheme;
  }, []);

  useEffect(() => {
    setShowLastSeen(profile?.showLastSeen ?? true);
  }, [profile?.showLastSeen]);

  useEffect(() => {
    onAdminSubviewChange?.(isDeveloperMode && activeSubview === "admin");
  }, [activeSubview, isDeveloperMode, onAdminSubviewChange]);

  useEffect(() => {
    return () => {
      onAdminSubviewChange?.(false);
    };
  }, [onAdminSubviewChange]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const cachedEntry = getCachedDeveloperBlocks(profile.id);

    if (cachedEntry) {
      setAdminBlocks(cachedEntry.entries);
      setIsAdminBlocksLoading(false);
    }
  }, [profile?.id]);

  const persistAdminBlocks = useCallback(
    (entries: DeveloperBlockEntry[]) => {
      if (!profile?.id) {
        return;
      }

      setCachedDeveloperBlocks(profile.id, {
        entries,
        fetchedAt: Date.now()
      });
    },
    [profile?.id]
  );

  const loadAdminBlocks = useCallback(
    async (forceRefresh = false) => {
      if (!isDeveloperMode || !profile?.id) {
        return [] as DeveloperBlockEntry[];
      }

      const cachedEntry = getCachedDeveloperBlocks(profile.id);

      if (cachedEntry) {
        setAdminBlocks(cachedEntry.entries);
        setIsAdminBlocksLoading(false);
      }

      if (!forceRefresh && adminBlocksFetchPromiseRef.current) {
        return adminBlocksFetchPromiseRef.current;
      }

      if (!cachedEntry) {
        setIsAdminBlocksLoading(true);
      }

      setIsAdminBlocksRefreshing(true);
      setAdminBlocksError(null);

      const fetchPromise = getDeveloperBlockEntries(supabase)
        .then((entries) => {
          setAdminBlocks(entries);
          persistAdminBlocks(entries);
          return entries;
        })
        .catch((error) => {
          console.error("Failed to load developer block entries", error);
          setAdminBlocksError(copy.settings.developerUnblockError);
          return cachedEntry?.entries ?? [];
        })
        .finally(() => {
          if (adminBlocksFetchPromiseRef.current === fetchPromise) {
            adminBlocksFetchPromiseRef.current = null;
          }

          setIsAdminBlocksLoading(false);
          setIsAdminBlocksRefreshing(false);
        });

      adminBlocksFetchPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [copy.settings.developerUnblockError, isDeveloperMode, persistAdminBlocks, profile?.id, supabase]
  );

  useEffect(() => {
    if (!isDeveloperMode || !isVisible) {
      return;
    }

    void loadAdminBlocks(true);
  }, [isDeveloperMode, isVisible, loadAdminBlocks]);

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    description: string;
  }> = [
    {
      value: "theme-soft",
      label: "Light",
      description: copy.settings.themeSoftDescription
    },
    {
      value: "theme-dark",
      label: "Dark",
      description: copy.settings.themeDarkDescription
    },
    {
      value: "theme-light",
      label: "Ice",
      description: copy.settings.themeLightDescription
    },
    {
      value: "theme-classic",
      label: "Classic",
      description: copy.settings.themeClassicDescription
    }
  ];

  const handleThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleLastSeenToggle = () => {
    const nextValue = !showLastSeen;
    setShowLastSeen(nextValue);
    setLastSeenError(null);

    startLastSeenTransition(async () => {
      const result = await updateLastSeenVisibilityAction(nextValue);

      if (result.error) {
        setShowLastSeen(!nextValue);
        setLastSeenError(copy.settings.lastSeenVisibilityError);
        return;
      }

      if (result.profile) {
        onProfileUpdated?.(result.profile);
      }
    });
  };

  const handleDeveloperUnblock = (entry: DeveloperBlockEntry) => {
    const previousEntries = adminBlocks ?? [];
    const nextEntries = previousEntries.filter((item) => item.id !== entry.id);

    setPendingAdminBlockId(entry.id);
    setAdminBlocks(nextEntries);
    setAdminBlocksError(null);
    persistAdminBlocks(nextEntries);

    startAdminUnblockTransition(async () => {
      const result = await developerUnblockUserAction({
        blockId: entry.id,
        blockerUserId: entry.blockerUserId,
        blockedUserId: entry.blockedUserId
      });

      if (result.error) {
        setAdminBlocks(previousEntries);
        persistAdminBlocks(previousEntries);
        setAdminBlocksError(result.error);
      }

      setPendingAdminBlockId(null);
    });
  };

  const segmentButtonClassName = (tab: SettingsSubview) =>
    cn(
      "inline-flex min-w-[110px] items-center justify-center rounded-[14px] px-4 py-2 text-[13px] font-medium transition",
      activeSubview === tab
        ? "bg-brand-500 text-white shadow-float"
        : "bg-transparent text-slate-600 hover:bg-slate-50"
    );

  return (
    <div className="space-y-4">
      {isDeveloperMode ? (
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-[16px] border border-slate-200 bg-white p-1 shadow-soft">
            <button
              type="button"
              className={segmentButtonClassName("settings")}
              onClick={() => setActiveSubview("settings")}
            >
              {copy.settings.developerSettingsTab}
            </button>
            <button
              type="button"
              className={segmentButtonClassName("admin")}
              onClick={() => setActiveSubview("admin")}
            >
              {copy.settings.developerAdminTab}
            </button>
          </div>

          <div className="min-h-[28px] shrink-0">
            {isAdminBlocksRefreshing ? (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-soft sm:text-[12px]">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>{copy.hero.refreshing}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {adminBlocksError ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-600 shadow-soft sm:text-sm">
          {adminBlocksError}
        </div>
      ) : null}

      {isDeveloperMode && activeSubview === "admin" ? (
        <DeveloperBlocksPanel
          blocks={adminBlocks}
          isLoading={isAdminBlocksLoading}
          isPending={isAdminUnblockPending}
          locale={locale}
          pendingBlockId={pendingAdminBlockId}
          unblockLabel={copy.settings.developerUnblockAction}
          emptyLabel={copy.settings.developerAdminEmpty}
          refreshingLabel={copy.hero.refreshing}
          onUnblock={handleDeveloperUnblock}
        />
      ) : (
        <SettingsMainContent
          copy={copy}
          deleteConfirmPlaceholder={copy.settings.deleteConfirmPlaceholder}
          deleteError={deleteError}
          deleteFormAction={deleteFormAction}
          deleteOpen={deleteOpen}
          dictionary={dictionary}
          handleLastSeenToggle={handleLastSeenToggle}
          handleThemeChange={handleThemeChange}
          isDeletePending={isDeletePending}
          isLastSeenPending={isLastSeenPending}
          lastSeenError={lastSeenError}
          locale={locale}
          logoutAction={logoutAction}
          setDeleteOpen={setDeleteOpen}
          showLastSeen={showLastSeen}
          theme={theme}
          themeOptions={themeOptions}
        />
      )}
    </div>
  );
}

function SettingsMainContent({
  copy,
  deleteConfirmPlaceholder,
  deleteError,
  deleteFormAction,
  deleteOpen,
  dictionary,
  handleLastSeenToggle,
  handleThemeChange,
  isDeletePending,
  isLastSeenPending,
  lastSeenError,
  locale,
  logoutAction,
  setDeleteOpen,
  showLastSeen,
  theme,
  themeOptions
}: {
  copy: ReturnType<typeof getUiCopy>;
  deleteConfirmPlaceholder: string;
  deleteError: string | undefined;
  deleteFormAction: (payload: FormData) => void;
  deleteOpen: boolean;
  dictionary: ReturnType<typeof useDictionary>;
  handleLastSeenToggle: () => void;
  handleThemeChange: (theme: ThemeMode) => void;
  isDeletePending: boolean;
  isLastSeenPending: boolean;
  lastSeenError: string | null;
  locale: "ko" | "en" | "es";
  logoutAction: () => Promise<void>;
  setDeleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showLastSeen: boolean;
  theme: ThemeMode;
  themeOptions: Array<{
    value: ThemeMode;
    label: string;
    description: string;
  }>;
}) {
  return (
    <>
      <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink sm:text-sm">
              {copy.settings.lastSeenVisibilityTitle}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {copy.settings.lastSeenVisibilityDescription}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={showLastSeen}
            aria-label={copy.settings.lastSeenVisibilityTitle}
            disabled={isLastSeenPending}
            onClick={handleLastSeenToggle}
            className={cn(
              "relative inline-flex h-[34px] w-[82px] shrink-0 items-center rounded-[14px] border p-[3px] transition-[background-color,border-color]",
              showLastSeen
                ? "border-brand-300 bg-brand-50"
                : "border-slate-200 bg-slate-100",
              isLastSeenPending && "opacity-70"
            )}
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-y-[3px] left-[3px] rounded-[12px] bg-white shadow-soft transition-transform duration-200 ease-out",
                showLastSeen ? "translate-x-0" : "translate-x-full"
              )}
              style={{ width: "calc(50% - 3px)" }}
            />
            <span className="relative z-10 grid w-full grid-cols-2 items-center text-[11px] font-semibold leading-none">
              <span
                className={cn(
                  "flex h-7 items-center justify-center text-center",
                  showLastSeen ? "text-brand-700" : "text-slate-400"
                )}
              >
                {copy.settings.visibilityOn}
              </span>
              <span
                className={cn(
                  "flex h-7 items-center justify-center text-center",
                  !showLastSeen ? "text-slate-700" : "text-slate-400"
                )}
              >
                {copy.settings.visibilityOff}
              </span>
            </span>
          </button>
        </div>

        {lastSeenError ? (
          <p className="mt-2 text-[11px] leading-5 text-rose-500 sm:text-[12px]">
            {lastSeenError}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-[13px] font-medium text-ink sm:text-sm">{copy.settings.themeTitle}</p>
        <p className="mt-1 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
          {copy.settings.themeDescription}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {themeOptions.map((option) => {
            const active = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={cn(
                  "rounded-[16px] border px-3 py-2.5 text-left transition",
                  active
                    ? "border-brand-300 bg-brand-50 shadow-float"
                    : "border-slate-200 bg-white shadow-soft hover:bg-slate-50"
                )}
              >
                <p className="text-[13px] font-semibold text-ink sm:text-sm">{option.label}</p>
                <p className="mt-1 text-[11px] leading-4.5 text-slate-500 sm:text-xs sm:leading-5">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <form
        action={logoutAction}
        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft"
      >
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-ink sm:text-sm">{dictionary.logout}</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {copy.settings.logoutDescription}
            </p>
          </div>
          <PrimaryButton type="submit" className="w-full py-2.5 sm:w-auto">
            {dictionary.logout}
          </PrimaryButton>
        </div>
      </form>

      <div className="space-y-3">
        <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-rose-700 sm:text-sm">
                {dictionary.deleteAccount}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-rose-600/90 sm:text-sm sm:leading-6">
                {copy.settings.deleteDescription}
              </p>
            </div>
            <SecondaryButton
              type="button"
              className="w-full border-rose-200 bg-white px-4 py-3 text-sm text-rose-600 shadow-soft hover:bg-rose-50 sm:w-auto sm:text-sm"
              onClick={() => setDeleteOpen((value) => !value)}
            >
              {deleteOpen ? dictionary.cancel : dictionary.deleteAccount}
            </SecondaryButton>
          </div>
        </div>

        {deleteOpen ? (
          <form
            action={deleteFormAction}
            className="space-y-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft"
          >
            <input type="hidden" name="locale" value={locale} />
            {deleteError ? (
              <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-600 shadow-soft sm:text-sm">
                {deleteError}
              </div>
            ) : null}

            <label className="flex items-start gap-3 rounded-[16px] border border-slate-200 bg-white px-3.5 py-2.5 text-[12px] text-slate-600 shadow-soft sm:text-sm">
              <input
                type="checkbox"
                name="acknowledge"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-200"
              />
              <span>{copy.settings.deleteAcknowledge}</span>
            </label>

            <Input
              id="confirmation"
              name="confirmation"
              label={copy.settings.deleteConfirmLabel}
              placeholder={deleteConfirmPlaceholder}
            />

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <SecondaryButton
                type="button"
                className="sm:w-auto"
                onClick={() => setDeleteOpen(false)}
              >
                {dictionary.cancel}
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                className="bg-rose-500 px-3 py-1.5 text-[11px] hover:bg-rose-600 sm:w-auto sm:text-sm"
                disabled={isDeletePending}
              >
                {isDeletePending ? dictionary.connecting : dictionary.deleteAccount}
              </PrimaryButton>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}

function DeveloperBlocksPanel({
  blocks,
  isLoading,
  isPending,
  locale,
  pendingBlockId,
  unblockLabel,
  emptyLabel,
  refreshingLabel,
  onUnblock
}: {
  blocks: DeveloperBlockEntry[] | null;
  isLoading: boolean;
  isPending: boolean;
  locale: "ko" | "en" | "es";
  pendingBlockId: string | null;
  unblockLabel: string;
  emptyLabel: string;
  refreshingLabel: string;
  onUnblock: (entry: DeveloperBlockEntry) => void;
}) {
  if (isLoading && !blocks) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft"
          >
            <div className="space-y-3">
              <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="h-10 animate-pulse rounded-[14px] bg-slate-100" />
              <div className="h-9 animate-pulse rounded-[14px] bg-brand-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    return (
      <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4 text-[12px] leading-6 text-slate-500 shadow-soft sm:text-sm">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((entry) => (
        <div
          key={entry.id}
          className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-soft"
        >
          <p className="text-[11px] font-medium text-slate-500 sm:text-[12px]">
            {formatDeveloperBlockTimestamp(entry.createdAt, locale)}
          </p>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink sm:text-sm">
                {entry.blocker.displayName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px]">
                {entry.blocker.email}
              </p>
            </div>

            <span className="text-sm font-semibold text-slate-400">→</span>

            <div className="min-w-0 text-right">
              <p className="truncate text-[13px] font-semibold text-ink sm:text-sm">
                {entry.blocked.displayName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px]">
                {entry.blocked.email}
              </p>
            </div>
          </div>

          <SecondaryButton
            type="button"
            className="mt-3 w-full rounded-[14px] py-2 text-[12px] sm:text-sm"
            disabled={pendingBlockId === entry.id && isPending}
            onClick={() => onUnblock(entry)}
          >
            {pendingBlockId === entry.id && isPending ? refreshingLabel : unblockLabel}
          </SecondaryButton>
        </div>
      ))}
    </div>
  );
}

function formatDeveloperBlockTimestamp(createdAt: string, locale: "ko" | "en" | "es") {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(createdDate);
}
