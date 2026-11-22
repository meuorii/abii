import Image from "next/image";

export const workspaceHeader = "relative z-20 flex h-[76px] shrink-0 items-center justify-between border-b border-[#F4EDF0] bg-white px-4 sm:px-6 lg:justify-end lg:px-8";
export const workspaceAccountButton = "flex min-h-10 items-center gap-2.5 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-pink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active";
export const workspaceAvatar = "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFE0E9] text-sm font-semibold text-[#D94E7B]";
export const workspaceAccountName = "hidden max-w-[150px] truncate text-xs font-medium text-[#657B8E] sm:block";
export const workspaceChevron = "hidden h-4 w-4 text-[#8292A0] sm:block";
export const workspaceAccountPanel = "absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#E8E2E5] bg-white p-2 shadow-lg";
export const workspaceNavLink = "flex min-h-[43px] items-center gap-3 rounded-[10px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active";
export const workspaceNavActive = "bg-pink-card text-pink-active";
export const workspaceNavInactive = "text-[#6F8293] hover:bg-[#FFF4F7] hover:text-foreground";

export function WorkspaceBrandMark({ alt = "" }: { alt?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-card">
        <Image src="/abii-head.png" alt={alt} width={40} height={40} priority className="h-full w-full object-contain" />
      </span>
      <span className="font-brand text-[29px] leading-none text-pink-active">Abii</span>
    </span>
  );
}

export const workspaceBrandSubtitle = "pl-[48px] text-[10px] leading-4 text-[#8B7C84]";

export function WorkspaceSidebarFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative mt-auto h-[110px] overflow-hidden px-5 pb-5 pt-2 ${className}`}>
      <p className="relative z-10 text-[11px] leading-[1.65] text-[#8B9BAA]">
        <span aria-hidden="true" className="mb-1 block text-base leading-none text-pink-accent">♥</span>
        Small steps,<br />big progress!
      </p>
      <div className="absolute -bottom-8 -left-5 h-20 w-40 rounded-[50%] bg-[#FFF0F5]" />
      <div className="absolute -bottom-10 left-16 h-20 w-28 rounded-[50%] bg-[#FFF0F5]" />
    </div>
  );
}
