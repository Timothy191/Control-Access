"use client";

import { useState } from "react";
import { IconIdBadge2, IconUserPlus, IconUserCancel, IconPrinter, IconCheck, IconX, IconQrcode, IconNfc } from "@tabler/icons-react";

export interface DirectoryEmployee {
  id: number;
  emp_code: string;
  first_name: string;
  surname: string;
  rfid_tag?: string | null;
  qr_code?: string | null;
}

export interface DirectoryVisitor {
  id: number;
  name: string;
  rfid_tag?: string | null;
  qr_code?: string | null;
}

export default function AccessCardsClient({
  employees,
  visitors,
}: {
  employees: DirectoryEmployee[];
  visitors: DirectoryVisitor[];
}) {
  const [activeAction, setActiveAction] = useState<"ASSIGN" | "REVOKE" | "PRINT" | null>(null);
  
  // Form States
  const [entityType, setEntityType] = useState("EMPLOYEE");
  const [entityId, setEntityId] = useState("");
  const [cardType, setCardType] = useState("RFID");
  const [cardData, setCardData] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const getList = (): (DirectoryEmployee | DirectoryVisitor)[] => entityType === "EMPLOYEE" ? employees : visitors;

  const handleAction = async (endpoint: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, cardType, cardData }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully processed ${cardType} for selected entity.` });
        setCardData("");
      } else {
        setMessage({ type: 'error', text: data.error || "Action failed." });
      }
    } catch {
      setMessage({ type: 'error', text: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const selectedEntity = getList().find(e => e.id.toString() === entityId);

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    let displayName = 'SELECT A PERSON';
    let displayRole = 'VISITOR - GUEST';
    if (selectedEntity) {
      if ('first_name' in selectedEntity) {
        displayName = `${selectedEntity.first_name} ${selectedEntity.surname}`;
        displayRole = `EMPLOYEE - ${selectedEntity.emp_code}`;
      } else {
        displayName = selectedEntity.name || 'GUEST';
        displayRole = 'VISITOR - GUEST';
      }
    }

    const html = `
      <html>
        <head>
          <title>Print ID Badge - Neo300magicpress</title>
          <style>
            @page { size: 3.375in 2.125in; margin: 0; }
            body { margin: 0; padding: 0; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card {
              width: 3.375in;
              height: 2.125in;
              background-color: #ffffff;
              color: #000000;
              position: relative;
              box-sizing: border-box;
            }
            .header { background-color: #007AFF; color: white; padding: 10px; font-weight: bold; font-size: 14px; text-align: center; }
            .photo-box { position: absolute; top: 40px; left: 10px; width: 60px; height: 80px; background-color: #eee; border: 1px solid #999; text-align: center; line-height: 80px; font-size: 10px; color: #666; }
            .details { position: absolute; top: 45px; left: 80px; }
            .name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .role { font-size: 10px; color: #555; text-transform: uppercase; }
            .footer { position: absolute; bottom: 10px; left: 0; width: 100%; text-align: center; font-size: 8px; color: #666; }
            .qr-placeholder { position: absolute; bottom: 15px; right: 10px; width: 30px; height: 30px; background-color: #000; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">PLANTCOR MINING SITE</div>
            <div class="photo-box">PHOTO</div>
            <div class="details">
              <div class="name">${displayName}</div>
              <div class="role">${displayRole}</div>
            </div>
            <div class="qr-placeholder"></div>
            <div class="footer">Property of Plantcor. Return if found.</div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-6 sm:p-10 max-w-[1200px] mx-auto space-y-10 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="relative">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 font-sans tracking-tight">Access Provisioning</h1>
        <p className="text-sm text-neutral-400 font-mono mt-2 flex items-center gap-2">
          <IconNfc size={16} className="text-blue-400" /> Manage RFID tags, NFC credentials, and QR codes.
        </p>
      </div>

      {/* Action Cards (Bento Box Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div 
          onClick={() => setActiveAction("ASSIGN")} 
          className={`relative overflow-hidden bg-black/40 backdrop-blur-xl border ${activeAction === 'ASSIGN' ? 'border-[#007AFF] shadow-[0_0_30px_rgba(0,122,255,0.2)]' : 'border-white/10 hover:border-white/20'} rounded-3xl p-6 transition-all duration-300 cursor-pointer group active:scale-[0.99]`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#007AFF]/10 rounded-bl-full -z-10 group-hover:bg-[#007AFF]/20 transition-colors" />
          <div className="h-14 w-14 rounded-2xl bg-[#007AFF]/15 border border-[#007AFF]/30 text-[#007AFF] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
            <IconUserPlus size={26} stroke={1.5} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Assign Credential</h2>
          <p className="text-xs text-neutral-400 font-mono leading-relaxed">Link a new physical RFID tag, NFC card, or generate a digital QR payload.</p>
        </div>

        <div 
          onClick={() => setActiveAction("REVOKE")} 
          className={`relative overflow-hidden bg-black/40 backdrop-blur-xl border ${activeAction === 'REVOKE' ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.2)]' : 'border-white/10 hover:border-white/20'} rounded-3xl p-6 transition-all duration-300 cursor-pointer group active:scale-[0.99]`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full -z-10 group-hover:bg-rose-500/10 transition-colors" />
          <div className="h-14 w-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform shadow-inner">
            <IconUserCancel size={26} stroke={1.5} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Revoke Access</h2>
          <p className="text-xs text-neutral-400 font-mono leading-relaxed">Deactivate a compromised, lost, or stolen hardware access card instantly.</p>
        </div>

        <div 
          onClick={() => setActiveAction("PRINT")} 
          className={`relative overflow-hidden bg-black/40 backdrop-blur-xl border ${activeAction === 'PRINT' ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-white/10 hover:border-white/20'} rounded-3xl p-6 transition-all duration-300 cursor-pointer group active:scale-[0.99]`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner">
            <IconPrinter size={26} stroke={1.5} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Print ID Badge</h2>
          <p className="text-xs text-neutral-400 font-mono leading-relaxed">Send a CR80 standard badge template directly to the Magicard Neo 300.</p>
        </div>

      </div>

      {/* Main Workspace Area */}
      <div className="relative rounded-3xl border border-white/[0.08] bg-[#0A0A0A]/60 backdrop-blur-2xl p-8 sm:p-12 min-h-[450px] shadow-2xl overflow-hidden">
        {/* Decorative Grid Background inside Workspace */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none" />

        {!activeAction ? (
          <div className="flex flex-col items-center justify-center text-center h-full pt-16 pb-8 relative z-10">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <div className="h-24 w-24 rounded-full bg-black/50 border border-white/10 flex items-center justify-center relative backdrop-blur-md">
                <IconIdBadge2 size={40} className="text-neutral-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">Workspace Ready</h3>
            <p className="text-sm text-neutral-500 mt-3 max-w-sm font-mono leading-relaxed">
              Select an operation from the modules above to securely manage perimeter access credentials.
            </p>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-8 relative z-10 animate-in slide-in-from-bottom-4 duration-500">
            
            <div className="border-b border-white/10 pb-5">
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                {activeAction === "ASSIGN" && <><IconUserPlus className="text-blue-400" /> Assign Credential</>}
                {activeAction === "REVOKE" && <><IconUserCancel className="text-red-400" /> Revoke Credential</>}
                {activeAction === "PRINT" && <><IconPrinter className="text-emerald-400" /> Print ID Badge</>}
              </h2>
            </div>

            {message && (
              <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-mono backdrop-blur-md border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {message.type === 'success' ? <IconCheck size={20} className="shrink-0" /> : <IconX size={20} className="shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold tracking-widest uppercase font-mono text-neutral-500 mb-2">Subject Classification</label>
                  <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setEntityId(""); }} className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all">
                    <option value="EMPLOYEE">Employee Personnel</option>
                    <option value="VISITOR">Guest / Visitor</option>
                  </select>
                </div>
                
                {activeAction !== "PRINT" && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold tracking-widest uppercase font-mono text-neutral-500 mb-2">Hardware Protocol</label>
                    <select value={cardType} onChange={(e) => setCardType(e.target.value)} className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all">
                      <option value="RFID">Physical RFID (125kHz/NFC)</option>
                      <option value="QR">Digital QR payload</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-widest uppercase font-mono text-neutral-500 mb-2">Target Identity</label>
                <div className="relative">
                  <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full h-14 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all appearance-none">
                    <option value="">-- Search Directory --</option>
                    {getList().map((e) => {
                      const emp = e as DirectoryEmployee;
                      const vis = e as DirectoryVisitor;
                      return (
                        <option key={e.id} value={e.id}>
                          {entityType === "EMPLOYEE"
                            ? `${emp.emp_code} • ${emp.first_name} ${emp.surname}`
                            : vis.name}
                          {e.rfid_tag ? ` [Bound]` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">▼</div>
                </div>
              </div>

              {activeAction === "ASSIGN" && (
                <div>
                  <label className="block text-[11px] font-bold tracking-widest uppercase font-mono text-neutral-500 mb-2 flex items-center justify-between">
                    <span>{cardType === 'QR' ? 'Generate or Paste QR Payload' : 'Scan Physical Tag UID'}</span>
                    {cardType === 'QR' && <IconQrcode size={14} className="text-blue-400" />}
                  </label>
                  <input 
                    type="text" 
                    value={cardData} 
                    onChange={(e) => setCardData(e.target.value)} 
                    placeholder={cardType === 'QR' ? 'e.g., QRPAYLOAD_XYZ123' : 'Awaiting scanner input...'} 
                    className="w-full h-14 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-blue-100 placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono tracking-widest" 
                  />
                  {cardType === 'QR' && (
                    <p className="text-[10px] text-neutral-500 font-mono mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span> High-density Aztec/QR formatting supported.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4">
              {activeAction === "ASSIGN" && (
                <button disabled={loading || !entityId || !cardData} onClick={() => handleAction("/api/cards/assign")} className="w-full h-14 min-h-[56px] bg-[#007AFF] hover:bg-[#0A84FF] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,122,255,0.3)] hover:shadow-[0_0_30px_rgba(0,122,255,0.5)] active:scale-[0.99] cursor-pointer">
                  {loading ? "Provisioning..." : "Provision Credential"}
                </button>
              )}
              {activeAction === "REVOKE" && (
                <button disabled={loading || !entityId} onClick={() => handleAction("/api/cards/revoke")} className="w-full h-14 min-h-[56px] bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] cursor-pointer">
                  {loading ? "Revoking..." : "Execute Revocation"}
                </button>
              )}
              {activeAction === "PRINT" && (
                <button disabled={!entityId} onClick={handlePrint} className="w-full h-14 min-h-[56px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.99] cursor-pointer">
                  <IconPrinter size={20} /> Dispatch to Magicard Neo 300
                </button>
              )}
            </div>
            
            {activeAction === "PRINT" && (
              <div className="mt-6 p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-xl flex gap-4 items-start">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-1">
                  <IconIdBadge2 size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 mb-1 tracking-wider uppercase font-mono">Hardware Requirements</h4>
                  <ul className="text-[11px] text-neutral-400 font-mono leading-relaxed space-y-1 list-disc list-inside">
                    <li>Verify Magicard Neo 300 active connection</li>
                    <li>Ensure blank CR80 PVC stock is loaded</li>
                    <li>Browser print dialog: Margins to &quot;None&quot;</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
