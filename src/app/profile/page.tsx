"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type MedicalDocument = { id: string; name: string; exam_date: string | null; storage_path: string; mime_type: string; size_bytes: number; created_at: string };

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
  const [documentDate, setDocumentDate] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setBusy(false); return; }
    void (async () => {
      try {
        // Em celulares, getUser pode aguardar uma chamada de rede mesmo quando
        // a sessão já está persistida no navegador. A sessão local é suficiente
        // para montar a conta e evita uma tela de carregamento infinita.
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("session-timeout")), 8000)),
        ]);
        let account = sessionResult.data.session?.user ?? null;
        if (!account) {
          const userResult = await Promise.race([
            supabase.auth.getUser(),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("user-timeout")), 8000)),
          ]);
          account = userResult.data.user ?? null;
        }
        if (!account) { router.replace("/login"); return; }
        setUser(account);
        setName(String(account.user_metadata?.full_name || ""));
        setBirthDate(String(account.user_metadata?.birth_date || ""));
        setIntestinalHistory(String(account.user_metadata?.intestinal_history || ""));
        setBusy(false);
        const storedPath = account.user_metadata?.avatar_path;
        if (storedPath) {
          setAvatarPath(storedPath);
          void supabase.storage.from("profile-photos").createSignedUrl(storedPath, 3600).then(({ data: signed }) => {
            if (signed?.signedUrl) setAvatarPreview(signed.signedUrl);
          });
        }
        // Documentos são carregados separadamente; uma falha nessa tabela não
        // pode impedir o restante da conta de abrir no celular.
        const documentsResult = await Promise.race([
          supabase.from("medical_documents").select("id,name,exam_date,storage_path,mime_type,size_bytes,created_at").eq("user_id", account.id).order("exam_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("documents-timeout")), 8000)),
        ]);
        if (!documentsResult.error) setDocuments((documentsResult.data as MedicalDocument[] | null) ?? []);
      } catch {
        setLoadError("Não foi possível carregar sua conta. Verifique sua conexão e tente novamente.");
        setBusy(false);
      }
    })();
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
    if (!supabase) { window.location.assign("/login"); return; }
    // Inicia a revogação remota, mas não espera a rede para sair no móvel.
    void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    // Garante a limpeza do token persistido mesmo se a chamada de rede expirou.
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/^https?:\/\/([^.]+)/)?.[1];
    if (projectRef) {
      try {
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
        sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch { /* armazenamento indisponível */ }
    }
    window.location.assign("/login");
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
    if (!supabase || !user || !documentFile) { setError("Selecione um arquivo PDF com os resultados."); return; }
    if (documentFile.type !== "application/pdf") { setError("Por segurança, os exames devem ser enviados em formato PDF."); return; }
    if (documentFile.size > 10 * 1024 * 1024) { setError("O arquivo deve ter no máximo 10 MB."); return; }
    setDocumentsBusy(true); setError(null); setMessage(null);
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const documentBytes = await documentFile.arrayBuffer();
    const medicalStorage = supabase.storage.from("medical-exams");
    const signedUpload = await medicalStorage.createSignedUploadUrl(path, { upsert: false });
    const signedCreationError = signedUpload.error;
    let uploadError = signedUpload.error;
    if (!uploadError && signedUpload.data) {
      uploadError = (await medicalStorage.uploadToSignedUrl(path, signedUpload.data.token, documentBytes, { cacheControl: "3600", contentType: "application/pdf" })).error;
    }
    // O Storage pode devolver apenas "HTTP 400" pelo SDK. A tentativa direta
    // preserva a mesma sessão e permite recuperar a mensagem real da API.
    if (uploadError && !signedCreationError) {
      const { data: sessionData } = await supabase.auth.getSession();
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (sessionData.session && baseUrl && publishableKey) {
        const objectPath = path.split("/").map(encodeURIComponent).join("/");
        const directResponse = await fetch(`${baseUrl}/storage/v1/object/medical-exams/${objectPath}`, { method: "POST", headers: { apikey: publishableKey, Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/pdf", "x-upsert": "false", "cache-control": "3600" }, body: documentBytes });
        if (directResponse.ok) uploadError = null;
        else {
          let apiMessage = "HTTP " + directResponse.status;
          const rawBody = await directResponse.text();
          try { const body = JSON.parse(rawBody) as { message?: string; error?: string }; apiMessage = body.message || body.error || rawBody || apiMessage; } catch { apiMessage = rawBody || apiMessage; }
          uploadError = { message: `${apiMessage} (upload assinado: ${uploadError.message})`, statusCode: String(directResponse.status) } as typeof uploadError;
        }
      }
    }
    if (uploadError) {
      const details = uploadError.message.toLowerCase();
      const storageMessage = details.includes("bucket") || details.includes("not found")
        ? "O armazenamento de exames ainda não está configurado. Execute no Supabase o bloco do bucket medical-exams em supabase/schema.sql."
        : details.includes("row-level security") || details.includes("policy")
          ? "O Supabase bloqueou o envio. Execute novamente as políticas do bucket medical-exams em supabase/schema.sql."
          : `Não foi possível enviar o exame (${uploadError.message}${uploadError.statusCode ? ` · código ${uploadError.statusCode}` : ""}). Verifique se o PDF tem até 10 MB.`;
      setError(storageMessage); setDocumentsBusy(false); return;
    }
    const { data: row, error: insertError } = await supabase.from("medical_documents").insert({ user_id: user.id, name: documentFile.name, exam_date: documentDate || null, storage_path: path, mime_type: documentFile.type, size_bytes: documentFile.size }).select("id,name,exam_date,storage_path,mime_type,size_bytes,created_at").single();
    if (insertError || !row) { await supabase.storage.from("medical-exams").remove([path]); setError(`Não foi possível salvar o exame: ${insertError?.message || "erro desconhecido"}`); setDocumentsBusy(false); return; }
    setDocuments((current) => [row as MedicalDocument, ...current]); setDocumentDate(""); setDocumentFile(null); setMessage("Exame anexado com segurança."); setDocumentsBusy(false);
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

  if (!isSupabaseConfigured()) return <main className="flex min-h-screen items-center justify-center bg-[#fcfcf9] px-5 text-[#18342b]"><section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg"><h1 className="text-xl font-semibold">Meu Intestino</h1><p className="mt-3 text-sm text-[#698076]">Configure o Supabase para editar os dados da conta.</p></section></main>;
  if (busy && !user) return <main className="grid min-h-screen place-items-center bg-[#fcfcf9] text-sm text-[#698076]">Carregando sua conta…</main>;
  if (loadError && !user) return <main className="grid min-h-screen place-items-center bg-[#f9f7f3] px-5 text-center"><section className="max-w-md rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-[#9b4438]">{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#1b8b6f] px-5 py-3 text-sm font-semibold text-white">Tentar novamente</button></section></main>;

  return <main className="min-h-screen bg-[#f9f7f3] text-[#2c2c2c]"><div className="mx-auto max-w-3xl px-5 pb-12 sm:px-8">
    <header className="flex items-center justify-between border-b border-[#e8f5f2] py-5"><div className="flex items-center gap-3"><button type="button" onClick={() => router.push("/")} className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-[#1b8b6f] shadow-sm" aria-label="Voltar para a Home">‹</button><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b8b6f]">Meu Intestino</p><h1 className="text-2xl font-bold text-[#2c2c2c]">Minha conta</h1></div></div><button type="button" onClick={signOut} className="rounded-full border border-[#e2c5b9] bg-white px-4 py-2 text-sm font-semibold text-[#a34a3d]">Sair</button></header>
    <section className="mt-7 rounded-[28px] bg-gradient-to-br from-[#e8f5f2] to-[#d4f5ed] p-6"><div className="flex items-center gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#1b8b6f] bg-white text-3xl shadow-sm">{avatarPreview ? <img src={avatarPreview} alt="Foto do perfil" className="h-full w-full object-cover" /> : "🌿"}</div><div className="min-w-0"><p className="text-sm text-[#527063]">Seu espaço pessoal</p><h2 className="truncate text-2xl font-bold text-[#1b8b6f]">{name || "Olá por aqui"}</h2><p className="truncate text-sm text-[#527063]">{user?.email}</p></div></div><label className="mt-5 inline-flex cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1b8b6f] shadow-sm">{avatarFile ? "Trocar foto selecionada" : "Adicionar ou trocar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }} /></label></section>
    <form onSubmit={save} className="mt-6 space-y-5"><section className="rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Perfil</p><h2 className="mt-1 text-xl font-bold">Seus dados</h2><p className="mt-1 text-sm text-[#698076]">Mantenha suas informações atualizadas.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como você gostaria de ser chamado?" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base outline-none focus:border-[#1b8b6f]" /></label><label className="block text-sm font-semibold">Data de nascimento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base outline-none focus:border-[#1b8b6f]" /></label></div><div className="mt-4 rounded-xl bg-[#f2f6f2] p-3 text-xs text-[#698076]">E-mail da conta: <span className="font-semibold">{user?.email}</span></div></section><section className="rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Contexto de saúde</p><h2 className="mt-1 text-xl font-bold">Histórico do intestino</h2><p className="mt-1 text-sm text-[#698076]">Este contexto ajuda a IA a interpretar seus registros, sem substituir uma avaliação profissional.</p><textarea value={intestinalHistory} onChange={(event) => setIntestinalHistory(event.target.value)} placeholder="Conte brevemente seu histórico intestinal (opcional)" className="mt-4 block min-h-32 w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base outline-none focus:border-[#1b8b6f]" /><p className="mt-2 text-xs text-[#819189]">Você pode editar ou apagar este texto quando quiser.</p></section><button disabled={busy} className="w-full rounded-2xl bg-[#1b8b6f] py-4 font-semibold text-white shadow-[0_8px_20px_rgba(27,139,111,0.18)]">{busy ? "Salvando…" : "Salvar alterações"}</button>{message && <p className="rounded-xl bg-[#e8f5f2] p-3 text-sm text-[#38624c]">{message}</p>}{error && <p className="rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{error}</p>}</form>
    <section className="mt-6 rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Documentos</p><h2 className="mt-1 text-xl font-bold">Exames e documentos</h2><p className="mt-1 text-sm leading-relaxed text-[#698076]">Anexe o PDF com os resultados. O arquivo fica privado e disponível só para você.</p></div><span className="rounded-xl bg-[#e8f5f2] px-3 py-2 text-xl">📄</span></div><form onSubmit={addDocument} className="mt-5 space-y-3"><label className="block text-sm font-semibold text-[#38624c]">Data do exame<input required type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></label><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#9bcdbf] bg-[#f7faf7] px-4 py-4 text-sm text-[#527063]"><span className="text-xl">＋</span><span className="truncate">{documentFile ? documentFile.name : "Selecionar PDF (máx. 10 MB)"}</span><input required type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /></label><button disabled={documentsBusy || !documentFile} className="w-full rounded-2xl border border-[#9bcdbf] bg-[#f3f8f3] py-3 font-semibold text-[#1b8b6f] disabled:opacity-50">{documentsBusy ? "Enviando…" : "Anexar exame"}</button></form>{documents.length > 0 && <div className="mt-5 space-y-2">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7faf7] p-3"><button type="button" onClick={() => void openDocument(document)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-[#38624c]">📄 {document.name}</p><p className="mt-1 text-xs text-[#819189]">{document.exam_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${document.exam_date}T12:00:00`)) : "Data não informada"}</p></button><button type="button" disabled={documentsBusy} onClick={() => void removeDocument(document)} className="shrink-0 px-2 text-xs font-semibold text-[#a34a3d]">Excluir</button></div>)}</div>}{documents.length === 0 && <p className="mt-4 rounded-2xl bg-[#f7faf7] p-4 text-sm text-[#819189]">Nenhum documento anexado ainda.</p>}</section>
    <section className="mt-6 rounded-3xl border border-[#cfe8df] bg-[#e8f5f2] p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xl">◈</span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Integrações</p><h2 className="mt-1 text-xl font-bold text-[#245443]">Conectar ao Claude</h2><p className="mt-1 text-sm leading-relaxed text-[#527063]">Consulte seus próprios registros e relatórios pelo Claude usando o MCP, com autorização segura.</p><Link href="/mcp" className="mt-4 inline-flex rounded-xl bg-[#1b8b6f] px-4 py-2.5 text-sm font-semibold text-white">Configurar conexão</Link></div></div></section>{user?.email?.toLowerCase() === "bbarbosa0604@gmail.com" && <Link href="/admin" className="mt-5 flex items-center justify-between rounded-3xl border border-[#ead9b7] bg-[#fff7e6] p-5 text-[#765b2a]"><span><span className="block text-xs font-bold uppercase tracking-[0.16em]">Administração</span><span className="mt-1 block text-sm font-semibold">Usuários e frequência de uso</span></span><span className="text-xl">›</span></Link>}
    <section className="mt-6 rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Segurança</p><h2 className="mt-1 text-xl font-bold">Trocar senha</h2><p className="mt-1 text-sm leading-relaxed text-[#698076]">Confirme sua senha atual antes de definir uma nova.</p><form onSubmit={changePassword} className="mt-4 space-y-3"><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><div className="grid gap-3 sm:grid-cols-2"><input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha (mínimo 8)" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /><input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirme a nova senha" className="w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></div><button disabled={passwordBusy} className="w-full rounded-2xl border border-[#9bcdbf] bg-[#f3f8f3] py-3 font-semibold text-[#1b8b6f]">{passwordBusy ? "Atualizando…" : "Atualizar senha"}</button></form></section>
  </div></main>;
}
