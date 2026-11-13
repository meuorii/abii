"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Check, ShieldCheck, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalDangerClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { ProfilePictureCropModal } from "@/components/settings/profile-picture-crop-modal";

type InitialUser = { name: string; email: string; profileImage: string; memberSince: string | null };
type Notice = { kind: "success" | "error"; text: string } | null;

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-2.5 text-sm text-[#2F2930] outline-none transition-colors placeholder:text-[#8A7D84] focus:border-[#E9577D] focus:ring-2 focus:ring-[#FFE8EF]";
const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#E9577D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#C94369] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-2 text-sm font-semibold text-[#18384D] transition-colors hover:bg-[#FFF7F9] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const dangerButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E7B7C3] bg-white px-3.5 py-2 text-sm font-semibold text-[#B8435D] transition-colors hover:bg-[#FFF1F1] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function Notice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const success = notice.kind === "success";
  return <p role={success ? "status" : "alert"} aria-live={success ? "polite" : "assertive"} className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm leading-5 ${success ? "bg-[#EAF8F0] text-[#245E3D]" : "bg-[#FFF1F1] text-[#A63D4C]"}`}>{notice.text}</p>;
}

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export function ProfileClient({ initialUser }: { initialUser: InitialUser }) {
  const router = useRouter();
  const [name, setName] = useState(initialUser.name);
  const email = initialUser.email;
  const [profileImage, setProfileImage] = useState(initialUser.profileImage);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState("");
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [photoNotice, setPhotoNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const savingRef = useRef(false);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 80) {
      setProfileNotice({ kind: "error", text: "Enter a name between 1 and 80 characters." });
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving("profile");
    setProfileNotice(null);
    try {
      const data = await request("/api/account/profile", "PATCH", { name: normalizedName, email });
      setName(data.user.name);
      window.dispatchEvent(new CustomEvent("abii-profile-name-updated", { detail: { name: data.user.name } }));
      setProfileNotice({ kind: "success", text: data.message || "Name saved." });
    } catch (error) {
      setProfileNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update your name. Try again." });
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  async function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoNotice({ kind: "error", text: "Choose a JPG, PNG, or WebP image." });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPhotoNotice({ kind: "error", text: "Choose an image no larger than 15 MB." });
      return;
    }
    if (typeof createImageBitmap !== "function") {
      setPhotoNotice({ kind: "error", text: "Your browser cannot validate this image. Try another browser." });
      return;
    }
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width > 6000 || bitmap.height > 6000 || bitmap.width * bitmap.height > 20_000_000) {
        setPhotoNotice({ kind: "error", text: "Choose an image within 6000 × 6000 pixels and 20 megapixels." });
        return;
      }
    } catch {
      setPhotoNotice({ kind: "error", text: "This image could not be decoded. Choose another file." });
      return;
    } finally {
      bitmap?.close();
    }
    setPhotoNotice(null);
    setCropFile(file);
  }

  async function editSavedPhoto() {
    if (!profileImage || savingRef.current) return;
    savingRef.current = true;
    setSaving("photo");
    setPhotoNotice(null);
    try {
      const response = await fetch(profileImage, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("The saved photo could not be downloaded.");
      const blob = await response.blob();
      if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type) || blob.size > 15 * 1024 * 1024) {
        throw new Error("This saved image cannot be edited here. Choose the original photo again.");
      }
      setCropFile(new File([blob], "saved-profile-photo", { type: blob.type }));
    } catch {
      setPhotoNotice({ kind: "error", text: "This hosted photo can’t be edited here. Choose the original image to crop it." });
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  async function savePhoto(image: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving("photo");
    setPhotoNotice(null);
    try {
      const data = await request("/api/account/profile-picture", "PATCH", { image });
      if (typeof data.profileImage !== "string" || !data.profileImage) throw new Error("The saved photo URL was missing. Please try again.");
      setProfileImage(data.profileImage);
      window.dispatchEvent(new CustomEvent("abii-profile-image-updated", { detail: { profileImage: data.profileImage } }));
      setPhotoNotice({ kind: "success", text: "Profile photo updated." });
    } catch (error) {
      setPhotoNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update your photo. Try again." });
      throw error;
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  async function removePhoto() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving("photo");
    setPhotoNotice(null);
    try {
      const data = await request("/api/account/profile-picture", "DELETE");
      setProfileImage("");
      window.dispatchEvent(new CustomEvent("abii-profile-image-updated", { detail: { profileImage: "" } }));
      setPhotoNotice({ kind: "success", text: data.message || "Profile photo removed." });
    } catch (error) {
      setPhotoNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove your photo. Try again." });
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving("password");
    setPasswordNotice(null);
    try {
      const data = await request("/api/account/password", "PATCH", { currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({ kind: "success", text: data.message || "Password changed. Please log in again." });
      window.setTimeout(() => router.replace(data.redirectTo || "/login"), 1200);
    } catch (error) {
      setPasswordNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not change your password. Try again." });
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  async function deleteAccount() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving("account");
    setDeleteNotice(null);
    try {
      const data = await request("/api/account", "DELETE", { confirmation: "DELETE" });
      setDeleteNotice({ kind: "success", text: data.message || "Account deleted." });
      window.setTimeout(() => router.replace(data.redirectTo || "/"), 900);
    } catch (error) {
      setConfirmDelete(false);
      setDeleteNotice({ kind: "error", text: error instanceof Error ? error.message : "Your account could not be deleted. Try again." });
    } finally {
      savingRef.current = false;
      setSaving("");
    }
  }

  const initial = name.trim().charAt(0).toUpperCase() || "A";

  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-7 px-4 py-7 sm:space-y-9 sm:px-6 sm:py-9 xl:px-8">
    <header>
      <h1 className="text-[clamp(1.7rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-[#18384D] [text-wrap:balance]">My Profile</h1>
      <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[#557187]">Manage the details and security for your Abii account.</p>
    </header>

    <section aria-label="Account overview" className="flex min-w-0 flex-col gap-5 rounded-2xl border border-[#F0E5E9] bg-[#FFF7F9] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#FFE8EF] text-2xl font-bold text-[#B83F68] shadow-[0_2px_10px_rgba(47,41,48,0.08)]">
        {profileImage ? <Image key={profileImage} src={profileImage} alt={`${name || "Account"} profile photo`} fill sizes="72px" unoptimized className="object-cover" /> : initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-xl font-semibold tracking-[-0.025em] text-[#18384D]">{name || "Abii learner"}</p>
        <p className="mt-1 break-all text-sm text-[#557187]">{email}</p>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#276944]">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Verified account
        </span>
        {initialUser.memberSince && <p className="text-xs text-[#6E879A]">Member since {initialUser.memberSince}</p>}
      </div>
    </section>

    <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-10">
      <section aria-labelledby="personal-info-heading" className="min-w-0">
        <div className="border-b border-[#F0E5E9] pb-4">
          <h2 id="personal-info-heading" className="text-lg font-semibold tracking-[-0.02em] text-[#18384D]">Personal information</h2>
          <p className="mt-1 text-sm leading-5 text-[#6E879A]">Keep your account details up to date.</p>
        </div>

        <div className="border-b border-[#F0E5E9] py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#F4DCE4] bg-[#FFE8EF] text-xl font-semibold text-[#B83F68]">
              {profileImage ? <Image key={`edit-${profileImage}`} src={profileImage} alt={`${name || "Account"} profile photo`} fill sizes="64px" unoptimized className="object-cover" /> : initial}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#18384D]">Profile photo</h3>
              <p className="mt-1 text-xs leading-5 text-[#6E879A]">JPG, PNG, or WebP. Up to 15 MB and 20 megapixels.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className={`${secondaryButton} relative cursor-pointer focus-within:ring-2 focus-within:ring-[#E9577D] focus-within:ring-offset-2 ${saving ? "pointer-events-none opacity-60" : ""}`}>
                  <Camera aria-hidden="true" className="mr-2 h-4 w-4" />{saving === "photo" ? "Updating…" : "Choose photo"}
                  <input name="profilePhoto" aria-label="Choose profile photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(saving)} onChange={selectPhoto} />
                </label>
                {profileImage && <button type="button" disabled={Boolean(saving)} onClick={() => void editSavedPhoto()} className={secondaryButton}>Edit crop</button>}
                {profileImage && <button type="button" disabled={Boolean(saving)} onClick={() => void removePhoto()} className={secondaryButton}>Remove</button>}
              </div>
            </div>
          </div>
          <Notice notice={photoNotice} />
        </div>

        <form onSubmit={saveName} className="space-y-4 border-b border-[#F0E5E9] py-5">
          <div>
            <label htmlFor="profileName" className="text-sm font-semibold text-[#18384D]">Full name</label>
            <input id="profileName" name="name" autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="profileEmail" className="text-sm font-semibold text-[#18384D]">Email address</label>
            <div className="relative">
              <input id="profileEmail" name="email" type="email" autoComplete="email" value={email} readOnly aria-readonly="true" className={`${fieldClass} pr-11 text-[#5E7180]`} />
              <Check aria-hidden="true" className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#28734A]" />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[#6E879A]">Email changes require a separate verification process.</p>
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Notice notice={profileNotice} />
            <button type="submit" disabled={Boolean(saving)} className={`${primaryButton} shrink-0`}>{saving === "profile" ? "Saving name…" : "Save name"}</button>
          </div>
        </form>
      </section>

      <section aria-labelledby="security-heading" className="min-w-0">
        <div className="border-b border-[#F0E5E9] pb-4">
          <h2 id="security-heading" className="text-lg font-semibold tracking-[-0.02em] text-[#18384D]">Password & security</h2>
          <p className="mt-1 text-sm leading-5 text-[#6E879A]">Changing your password signs you out on this browser.</p>
        </div>
        <form onSubmit={changePassword} className="space-y-4 py-5">
          <div>
            <label htmlFor="currentPassword" className="text-sm font-semibold text-[#18384D]">Current password</label>
            <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="newPassword" className="text-sm font-semibold text-[#18384D]">New password</label>
            <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={fieldClass} />
            <p className="mt-1.5 text-xs text-[#6E879A]">Use at least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-[#18384D]">Confirm new password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-3 pt-1">
            <Notice notice={passwordNotice} />
            <button type="submit" disabled={Boolean(saving)} className={`${secondaryButton} self-start`}>{saving === "password" ? "Changing password…" : "Change password"}</button>
          </div>
        </form>
      </section>
    </div>

    <section aria-labelledby="danger-zone-heading" className="flex flex-col gap-4 border-t border-[#EADDE2] pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF1F1] text-[#B8435D]" aria-hidden="true"><Trash2 className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 id="danger-zone-heading" className="text-sm font-semibold text-[#A63D4C]">Delete account</h2>
          <p className="mt-1 max-w-[65ch] text-xs leading-5 text-[#6E6570]">Permanently removes your account, study materials, review history, and sessions. This can’t be undone.</p>
          <Notice notice={deleteNotice} />
        </div>
      </div>
      <button type="button" disabled={Boolean(saving)} onClick={() => { setDeleteText(""); setConfirmDelete(true); }} className={`${dangerButton} shrink-0`}>Delete account</button>
    </section>

    {cropFile && <ProfilePictureCropModal file={cropFile} onClose={() => setCropFile(null)} onSave={savePhoto} />}
    <Modal
      open={confirmDelete}
      onClose={() => { if (!saving) setConfirmDelete(false); }}
      action="delete"
      alert
      busy={saving === "account"}
      title="Delete your account?"
      description="Your account and all associated study data will be permanently deleted."
      footer={<>
        <button type="button" disabled={saving === "account"} onClick={() => setConfirmDelete(false)} className={modalCancelClass}>Cancel</button>
        <button type="button" disabled={saving === "account" || deleteText !== "DELETE"} onClick={() => void deleteAccount()} className={modalDangerClass}>
          <ModalButtonContent loading={saving === "account"} label="Delete account" loadingLabel="Deleting account…" />
        </button>
      </>}
    >
      <p className="text-sm leading-6 text-[#5E535A]">Your account, subjects, topics, flashcards, review history, and study sessions will be permanently deleted.</p>
      <label htmlFor="deleteAccountConfirm" className="mt-4 block text-sm font-semibold text-[#18384D]">Type DELETE to confirm</label>
      <input id="deleteAccountConfirm" name="confirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} className={fieldClass} placeholder="DELETE" autoComplete="off" />
    </Modal>
  </div>;
}
