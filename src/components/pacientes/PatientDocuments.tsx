
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Image, Download, Eye } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';

interface PatientDocumentsProps {
  patient: any;
}

const PatientDocuments = ({ patient }: PatientDocumentsProps) => {
  // TODO: Integrar com context quando documentos forem implementados
  const patientDocuments: any[] = [];

  const handleNewDocument = () => {
    // TODO: Integrar com modal de upload de documento
    console.log('Adicionar novo documento para:', patient.nome);
  };

  const getDocumentIcon = (tipo: string) => {
    switch (tipo) {
      case 'foto':
      case 'raio-x':
        return <Image className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getDocumentTypeLabel = (tipo: string) => {
    const labels: { [key: string]: string } = {
      'foto': 'Foto',
      'raio-x': 'Raio-X',
      'exame': 'Exame',
      'receita': 'Receita',
      'atestado': 'Atestado',
      'outro': 'Outro'
    };
    return labels[tipo] || tipo;
  };

  if (patientDocuments.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum documento encontrado"
        description="Este paciente ainda não possui documentos cadastrados"
        action={{
          label: 'Adicionar Documento',
          onClick: handleNewDocument
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documentos ({patientDocuments.length})</h3>
        <Button onClick={handleNewDocument} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Documento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patientDocuments.map((documento) => (
          <Card key={documento.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getDocumentIcon(documento.tipo)}
                  <Badge variant="outline" className="text-xs">
                    {getDocumentTypeLabel(documento.tipo)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <h4 className="font-medium text-sm mb-2">{documento.nome}</h4>
              
              {documento.descricao && (
                <p className="text-xs text-gray-600 mb-2">{documento.descricao}</p>
              )}
              
              <div className="text-xs text-gray-500">
                <p>Adicionado em: {new Date(documento.criadoEm).toLocaleDateString('pt-BR')}</p>
                {documento.tamanho && (
                  <p>Tamanho: {(documento.tamanho / 1024).toFixed(1)} KB</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PatientDocuments;
