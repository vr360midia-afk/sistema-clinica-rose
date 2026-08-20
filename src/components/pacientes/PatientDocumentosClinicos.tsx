import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Plus, Trash2, PenTool, Printer, MessageCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { useDocumentosClinicos, DocumentoClinico, DocumentoClinicoItem, DocumentoClinicoTipo } from '@/hooks/useDocumentosClinicos';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useDentistas } from '@/hooks/useDentistas';
import { useSignatures } from '@/hooks/useSignatures';
import SignatureModal from '@/components/signature/SignatureModal';
import { gerarDocumentoClinicoPdf } from '@/utils/documentoClinicoPdf';
import { openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';

interface Props {
  patient: any;
}

const PatientDocumentosClinicos = ({ patient }: Props) => {
  const { documentos, salvarDocumento, registrarAssinatura, registrarCfo, deleteDocumento } = useDocumentosClinicos(patient?.id);
  const { configuracoes } = useConfiguracoes();
  const { dentistas } = useDentistas();
  const { saveSignature } = useSignatures();

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<DocumentoClinicoTipo>('prescricao');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [dentista, setDentista] = useState('');
  const [dias, setDias] = useState('');
  const [cid, setCid] = useState('');
  const [itens, setItens] = useState<DocumentoClinicoItem[]>([{ nome: '', quantidade: '', posologia: '' }]);
  const [assinandoDoc, setAssinandoDoc] = useState<DocumentoClinico | null>(null);
  const [cfoDoc, setCfoDoc] = useState<DocumentoClinico | null>(null);
  const [cfoLink, setCfoLink] = useState('');
  const [cfoCodigo, setCfoCodigo] = useState('');

  const resetForm = () => {
    setTipo('prescricao');
    setTitulo('');
    setConteudo('');
    setDentista('');
    setDias('');
    setCid('');
    setItens([{ nome: '', quantidade: '', posologia: '' }]);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    await salvarDocumento({
      pacienteId: patient.id,
      pacienteNome: patient.nome,
      tipo,
      titulo: titulo || (tipo === 'atestado' ? 'Atestado odontológico' : 'Prescrição odontológica'),
      conteudo,
      itens: tipo === 'prescricao' ? itens.filter((i) => i.nome.trim()) : [],
      diasAfastamento: dias ? Number(dias) : null,
      cid: cid || null,
      dentista: dentista || null,
    });
    resetForm();
    setOpen(false);
  };

  const clinica = {
    nomeClinica: configuracoes.nomeClinica,
    logoUrl: configuracoes.logoUrl,
    cnpj: configuracoes.cnpj,
    endereco: configuracoes.endereco,
    telefone: configuracoes.telefone,
    email: configuracoes.email,
  };

  const handleAssinatura = async (doc: DocumentoClinico, data: any) => {
    const saved = await saveSignature(
      { ...data, documentType: doc.tipo },
      doc.id,
      patient.id
    );
    await registrarAssinatura(doc.id, {
      assinaturaData: data.signature,
      assinanteNome: data.signerName,
      assinaturaId: saved?.id || null,
    });
    setAssinandoDoc(null);
  };

  const handleWhatsApp = (doc: DocumentoClinico) => {
    if (!patient?.telefone) {
      toast.warning('Paciente sem telefone cadastrado.');
      return;
    }
    const msg = `Olá ${patient.nome}! Seu documento "${doc.titulo}" foi emitido${
      doc.assinadoEm ? ' e assinado digitalmente' : ''
    } por ${configuracoes.nomeClinica || 'nossa clínica'}. Em instantes enviaremos o PDF.`;
    openWhatsApp(patient.telefone, msg);
  };

  const textoCfo = (doc: DocumentoClinico) => {
    const linhas = [
      `Paciente: ${doc.pacienteNome || patient?.nome || ''}`,
      doc.dentista ? `Dentista: ${doc.dentista}` : '',
      '',
      doc.tipo === 'prescricao'
        ? doc.itens
            .map(
              (i) =>
                `${i.nome}${i.quantidade ? ` — ${i.quantidade}` : ''}${i.posologia ? ` — ${i.posologia}` : ''}`
            )
            .join('\n')
        : `${doc.diasAfastamento ? `${doc.diasAfastamento} dia(s) de afastamento` : ''}${
            doc.cid ? ` — CID ${doc.cid}` : ''
          }`,
      doc.conteudo ? `\n${doc.conteudo}` : '',
    ];
    return linhas.filter(Boolean).join('\n');
  };

  const abrirCfo = async (doc: DocumentoClinico) => {
    try {
      await navigator.clipboard.writeText(textoCfo(doc));
      toast.success('Conteúdo copiado. Cole no portal do CFO.');
    } catch {
      toast.info('Abra o portal do CFO e preencha a prescrição.');
    }
    window.open('https://prescricao.cfo.org.br/index', '_blank', 'noopener,noreferrer');
    setCfoDoc(doc);
    setCfoLink(doc.cfoLinkValidacao || '');
    setCfoCodigo(doc.cfoCodigoValidacao || '');
  };

  const salvarCfo = async () => {
    if (!cfoDoc) return;
    await registrarCfo(cfoDoc.id, { link: cfoLink.trim(), codigo: cfoCodigo.trim() });
    setCfoDoc(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Prescrições e atestados
        </h3>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo documento
        </Button>
      </div>

      {!documentos.length && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum documento emitido para este paciente.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {documentos.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  {doc.titulo}
                  <Badge variant="outline">{doc.tipo === 'atestado' ? 'Atestado' : 'Prescrição'}</Badge>
                  {doc.assinadoEm ? (
                    <Badge className="bg-green-600 hover:bg-green-600">Assinado</Badge>
                  ) : (
                    <Badge variant="secondary">Sem assinatura</Badge>
                  )}
                  {doc.cfoEmitidoEm && (
                    <Badge variant="outline" className="border-primary text-primary">CFO</Badge>
                  )}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {doc.criadoEm.toLocaleDateString('pt-BR')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {doc.tipo === 'prescricao' && !!doc.itens.length && (
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {doc.itens.map((i, idx) => (
                    <li key={idx}>
                      {i.nome} {i.quantidade ? `— ${i.quantidade}` : ''} {i.posologia ? `— ${i.posologia}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {doc.tipo === 'atestado' && (
                <p className="text-sm text-muted-foreground">
                  {doc.diasAfastamento ? `${doc.diasAfastamento} dia(s) de afastamento` : 'Sem afastamento'}
                  {doc.cid ? ` • CID ${doc.cid}` : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => gerarDocumentoClinicoPdf(doc, clinica)}>
                  <Printer className="h-4 w-4 mr-2" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAssinandoDoc(doc)}>
                  <PenTool className="h-4 w-4 mr-2" /> {doc.assinadoEm ? 'Reassinar' : 'Assinar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirCfo(doc)}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Emitir no CFO
                </Button>
                {doc.cfoLinkValidacao && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={doc.cfoLinkValidacao} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> Validar
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleWhatsApp(doc)}>
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteDocumento(doc.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo documento clínico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as DocumentoClinicoTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prescricao">Prescrição</SelectItem>
                    <SelectItem value="atestado">Atestado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dentista</Label>
                <Select value={dentista} onValueChange={setDentista}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {dentistas.filter((d) => d.ativo).map((d) => (
                      <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'atestado' ? 'Atestado odontológico' : 'Prescrição odontológica'} />
            </div>

            {tipo === 'prescricao' ? (
              <div className="space-y-2">
                <Label>Medicamentos</Label>
                {itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Medicamento"
                      value={item.nome}
                      onChange={(e) => setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, nome: e.target.value } : it)))}
                    />
                    <Input
                      placeholder="Qtd."
                      value={item.quantidade || ''}
                      onChange={(e) => setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, quantidade: e.target.value } : it)))}
                    />
                    <Input
                      placeholder="Posologia"
                      value={item.posologia || ''}
                      onChange={(e) => setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, posologia: e.target.value } : it)))}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setItens((p) => [...p, { nome: '', quantidade: '', posologia: '' }])}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar item
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dias de afastamento</Label>
                  <Input type="number" min={0} value={dias} onChange={(e) => setDias(e.target.value)} />
                </div>
                <div>
                  <Label>CID (opcional)</Label>
                  <Input value={cid} onChange={(e) => setCid(e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {assinandoDoc && (
        <SignatureModal
          isOpen={!!assinandoDoc}
          onClose={() => setAssinandoDoc(null)}
          signerName={assinandoDoc.dentista || configuracoes.nomeClinica || 'Responsável'}
          signerRole="dentista"
          documentType={assinandoDoc.tipo}
          description="A assinatura é armazenada com segurança na nuvem e aplicada ao PDF do documento."
          onSignatureComplete={(data) => handleAssinatura(assinandoDoc, data)}
        />
      )}
    </div>
  );
};

export default PatientDocumentosClinicos;
