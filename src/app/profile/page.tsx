"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type MedicalDocument = { id: string; name: string; exam_type: string | null; exam_date: string | null; storage_path: string; mime_type: string; size_bytes: number; created_at: string };

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [intestinalHistory, setIntestinalHistory] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentsBusy, setDocumentsBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setBusy(false); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
      setName(String(data.user.user_metadata?.full_name || ""));
      setBirthDate(String(data.user.user_metadata?.birth_date || ""));
      setIntestinalHistory(String(data.user.user_metadata?.intestinal_history || ""));
      const storedPath = data.user.user_metadata?.avatar_path;
      if (storedPath) {
        setAvatarPath(storedPath);
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(storedPath, 3600);
        if (signed?.signedUrl) setAvatarPreview(signed.signedUrl);
      }
      const { data: savedDocuments } = await supabase.from("medical_documents").select("id,name,exam_type,exam_date,storage_path,mime_type,size_bytes,created_at").eq("user_id", data.user.id).order("exam_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      setDocuments((savedDocuments as MedicalDocument[] | null) ?? []);
      setBusy(false);
    });
  }, [router, supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError(null); setMessage(null);
    let nextAvatarPath = avatarPath;
    if (avatarFile) {
      nextAvatarPath = `${user.id}/avatar-${Date.now()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      // O caminho inclui timestamp, portanto cada envio é um novo objeto. Evitar
      // upsert elimina a necessidade de UPDATE/SELECT durante o upload.
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(nextAvatarPath, avatarFile, { upsert: false });
      if (uploadError) {
        const storageMessage = uploadError.message.toLowerCase().includes("bucket not found")
          ? "O Supabase bloqueou o envio por segurança. Execute as políticas do bucket profile-photos no arquivo supabase/schema.sql e tente novamente."
          : `Não foi possível enviar a foto: ${uploadError.message}`;
        setError(storageMessage); setBusy(false); return;
      }
      const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(nextAvatarPath, 3600);
      if (signed?.signedUrl) setAvatarPreview(signed.signedUrl);
    }
    const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim(), birth_date: birthDate || null, avatar_path: nextAvatarPath, intestinal_history: intestinalHistory.trim() } });
    if (updateError) setError(updateError.message);
    else { setAvatarPath(nextAvatarPath); setAvatarFile(null); setMessage("Dados da conta atualizados."); }
    setBusy(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user?.email) return;
    setPasswordBusy(true); setError(null); setMessage(null);
    if (newPassword.length < 8) { setError("A nova senha deve ter pelo menos 8 caracteres."); setPasswordBusy(false); return; }
    if (newPassword !== confirmPassword) { setError("A confirmação da nova senha não confere."); setPasswordBusy(false); return; }
    const { error: currentError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (currentError) { setError("A senha atual está incorreta."); setPasswordBusy(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) setError(updateError.message);
    else { setMessage("Senha alterada com sucesso."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
    setPasswordBusy(false);
  }

  async function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !documentFile) { setError("Selecione um arquivo de exame."); return; }
    if (documentFile.size > 10 * 1024 * 1024) { setError("O arquivo deve ter no máximo 10 MB."); return; }
    setDocumentsBusy(true); setError(null); setMessage(null);
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("medical-exams").upload(path, documentFile, { upsert: false, contentType: documentFile.type || "application/octet-stream" });
    if (uploadError) { setError(`Não foi possível enviar o exame: ${uploadError.message}`); setDocumentsBusy(false); return; }
    const { data: row, error: insertError } = await supabase.from("medical_documents").insert({ user_id: user.id, name: documentName.trim() || documentFile.name, exam_type: documentType.trim() || null, exam_date: documentDate || null, storage_path: path, mime_type: documentFile.type || "application/octet-stream", size_bytes: documentFile.size }).select("id,name,exam_type,exam_date,storage_path,mime_type,size_bytes,created_at").single();
    if (insertError || !row) { await supabase.storage.from("medical-exams").remove([path]); setError(`Não foi possível salvar o exame: ${insertError?.message || "erro desconhecido"}`); setDocumentsBusy(false); return; }
    setDocuments((current) => [row as MedicalDocument, ...current]); setDocumentName(""); setDocumentType(""); setDocumentDate(""); setDocumentFile(null); setMessage("Exame anexado com segurança."); setDocumentsBusy(false);
  }

  async function openDocument(document: MedicalDocument) {
    if (!supabase) return;
    const { data, error: signedError } = await supabase.storage.from("medical-exams").createSignedUrl(document.storage_path, 300);
    if (signedError || !data?.signedUrl) { setError("Não foi possível abrir este arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDocument(document: MedicalDocument) {
    if (!supabase || !window.confirm(`Excluir “${document.name}”?`)) return;
    setDocumentsBusy(true); setError(null);
    const { error: deleteError } = await supabase.from("medical_documents").delete().eq("id", document.id).eq("user_id", user?.id || "");
    if (deleteError) { setError(`Não foi possível excluir: ${deleteError.message}`); setDocumentsBusy(false); return; }
    await supabase.storage.from("medical-exams").remove([document.storage_path]);
    setDocuments((current) => current.filter((item) => item.id !== document.id)); setDocumentsBusy(false);
  }

  if (!isSupabaseConfigured()) return <main className="flex min-h-screen items-center justify-center bg-[#fcfcf9] px-5 text-[#18342b]"><section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg"><h1 className="text-xl font-semibold">Meuintestino</h1><p className="mt-3 text-sm text-[#698076]">Configure o Supabase para editar os dados da conta.</p></section></main>;
  if (busy && !user) return <main className="grid min-h-screen place-items-center bg-[#fcfcf9] text-sm text-[#698076]">Carregando sua conta…</main>;

  return <main className="mx-auto min-h-screen max-w-md bg-[#fcfcf9] px-5 pb-10 text-[#18342b]">
    <header className="flex items-center gap-3 pt-8"><button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl">‹</button><div><p className="text-sm text-[#698076]">Meuintestino</p><h1 className="text-2xl font-semibold">Minha conta</h1></div></header>
    <form onSubmit={save} className="mt-7 space-y-5">
      <div className="flex items-center gap-4 rounded-3xl border border-[#e6ebe5] bg-white p-5"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e6f1e9] text-3xl">{avatarPreview ? <img src={avatarPreview} alt="Foto do perfil" className="h-full w-full object-cover" /> : "🌿"}</div><label className="cursor-pointer text-sm font-semibold text-[#39734f]">{avatarFile ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }} /></label></div>
      <label className="block text-sm font-semibold">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como você gostaria de ser chamado?" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <label className="block text-sm font-semibold">Data de nascimento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <label className="block text-sm font-semibold">Histórico do intestino <span className="font-normal text-[#698076]">(opcional)</span><textarea value={intestinalHistory} onChange={(event) => setIntestinalHistory(event.target.value)} placeholder="Conte brevemente seu histórico intestinal para ajudar na análise dos registros." className="mt-2 block min-h-28 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /><span className="mt-1 block text-xs font-normal text-[#698076]">Use este campo como contexto pessoal. Ele não é um diagnóstico médico.</span></label>
      <div className="rounded-xl bg-[#f2f6f2] p-3 text-xs text-[#698076]">E-mail da conta: <span className="font-semibold">{user?.email}</span></div>
      <button disabled={busy} className="w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">{busy ? "Salvando…" : "Salvar alterações"}</button>
      {message && <p className="rounded-xl bg-[#e9f3eb] p-3 text-sm text-[#38624c]">{message}</p>}
      {error && <p className="rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{error}</p>}
    </form>
    <section className="mt-7 rounded-3xl border border-[#e6ebe5] bg-white p-5"><div><h2 className="text-lg font-semibold">Exames e documentos</h2><p className="mt-1 text-sm leading-relaxed text-[#698076]">Anexe resultados para consultar quando precisar. Os arquivos são privados e não entram automaticamente na análise da IA.</p></div><form onSubmit={addDocument} className="mt-4 space-y-3"><input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Nome do exame (opcional)" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><input value={documentType} onChange={(event) => setDocumentType(event.target.value)} placeholder="Tipo do exame (opcional)" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><label className="block text-sm font-semibold text-[#38624c]">Data do exame<input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></label><label className="block cursor-pointer rounded-xl border border-dashed border-[#b9cfc0] bg-[#f7faf7] px-3 py-4 text-sm text-[#527063]">{documentFile ? documentFile.name : "Selecionar PDF ou imagem (máx. 10 MB)"}<input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /></label><button disabled={documentsBusy || !documentFile} className="w-full rounded-2xl border border-[#b9cfc0] bg-[#f3f8f3] py-3 font-semibold text-[#39734f] disabled:opacity-50">{documentsBusy ? "Enviando…" : "Anexar exame"}</button></form>{documents.length > 0 && <div className="mt-5 space-y-2">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7faf7] p-3"><button type="button" onClick={() => void openDocument(document)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-[#38624c]">📄 {document.name}</p><p className="mt-1 text-xs text-[#819189]">{document.exam_type || "Exame"}{document.exam_date ? ` · ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${document.exam_date}T12:00:00`))}` : ""}</p></button><button type="button" disabled={documentsBusy} onClick={() => void removeDocument(document)} className="shrink-0 px-2 text-xs font-semibold text-[#a34a3d]">Excluir</button></div>)}</div>}</section>
    <button type="button" onClick={signOut} className="mt-8 w-full rounded-2xl border border-[#efc9c2] bg-white py-4 font-semibold text-[#a34a3d]">Sair da conta</button>
    <section className="mt-6 rounded-3xl border border-[#e6ebe5] bg-white p-5"><h2 className="text-lg font-semibold">Trocar senha</h2><p className="mt-1 text-sm leading-relaxed text-[#698076]">Por segurança, confirme sua senha atual antes de definir uma nova.</p><form onSubmit={changePassword} className="mt-4 space-y-3"><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha (mínimo 8 caracteres)" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirme a nova senha" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><button disabled={passwordBusy} className="w-full rounded-2xl border border-[#b9cfc0] bg-[#f3f8f3] py-3 font-semibold text-[#39734f]">{passwordBusy ? "Atualizando…" : "Atualizar senha"}</button></form></section>
  </main>;
}
