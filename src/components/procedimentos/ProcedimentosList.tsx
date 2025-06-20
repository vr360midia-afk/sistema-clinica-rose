
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign, 
  Activity,
  Stethoscope,
  Eye,
  Copy
} from 'lucide-react';
import { Procedimento } from '@/types/procedimentos';

interface ProcedimentosListProps {
  procedimentos: Procedimento[];
  onEdit: (procedimento: Procedimento) => void;
  onDelete: (id: string) => void;
}

const getCategoriaColor = (categoria: string) => {
  const colors: Record<string, string> = {
    preventivo: 'bg-green-100 text-green-800',
    restaurador: 'bg-blue-100 text-blue-800',
    endodontico: 'bg-purple-100 text-purple-800',
    periodontico: 'bg-orange-100 text-orange-800',
    cirurgico: 'bg-red-100 text-red-800',
    protese: 'bg-indigo-100 text-indigo-800',
    ortodontico: 'bg-pink-100 text-pink-800',
    estetico: 'bg-yellow-100 text-yellow-800',
    emergencia: 'bg-red-100 text-red-800',
    outros: 'bg-gray-100 text-gray-800'
  };
  return colors[categoria] || colors.outros;
};

const getComplexidadeColor = (complexidade: string) => {
  const colors: Record<string, string> = {
    baixa: 'bg-green-100 text-green-800',
    media: 'bg-yellow-100 text-yellow-800',
    alta: 'bg-orange-100 text-orange-800',
    'muito-alta': 'bg-red-100 text-red-800'
  };
  return colors[complexidade] || colors.media;
};

const ProcedimentosList = ({ procedimentos, onEdit, onDelete }: ProcedimentosListProps) => {
  if (procedimentos.length === 0) {
    return (
      <div className="text-center py-12">
        <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum procedimento cadastrado</h3>
        <p className="text-gray-500">Comece criando seu primeiro procedimento</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {procedimentos.map((procedimento) => (
        <Card key={procedimento.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                    {procedimento.nome}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {procedimento.descricao}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {!procedimento.ativo && (
                    <Badge variant="secondary" className="text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={getCategoriaColor(procedimento.categoria)}>
                  {procedimento.categoria}
                </Badge>
                <Badge className={getComplexidadeColor(procedimento.complexidade)}>
                  {procedimento.complexidade}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-medium">R$ {procedimento.preco.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>{procedimento.duracaoMinutos} min</span>
                </div>
              </div>

              {procedimento.precoConvenio && (
                <div className="text-sm text-gray-600">
                  <span>Convênio: R$ {procedimento.precoConvenio.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500">
                {procedimento.requererAnestesia && (
                  <Badge variant="outline" className="text-xs">
                    Anestesia
                  </Badge>
                )}
                {procedimento.requererRaioX && (
                  <Badge variant="outline" className="text-xs">
                    Raio-X
                  </Badge>
                )}
              </div>

              {procedimento.codigoTUSS && (
                <div className="text-xs text-gray-500">
                  TUSS: {procedimento.codigoTUSS}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                <div className="text-xs text-gray-500">
                  Por: {procedimento.criadoPor}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(procedimento)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement duplicate functionality
                      console.log('Duplicate:', procedimento.id);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(procedimento.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProcedimentosList;
