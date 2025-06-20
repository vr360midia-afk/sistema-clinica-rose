import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Procedimento } from '@/types/procedimentos';
import { DollarSign, Clock } from 'lucide-react';

interface ProcedimentoSelectorProps {
  selectedProcedimentos: string[];
  onSelectionChange: (selected: string[]) => void;
  valorTotal: number;
}

const mockProcedimentos: Procedimento[] = [
  {
    id: '1',
    nome: 'Limpeza Dental',
    categoria: 'preventivo',
    descricao: 'Limpeza completa dos dentes',
    preco: 150.00,
    duracaoMinutos: 60,
    complexidade: 'baixa',
    requererAnestesia: false,
    requererRaioX: false,
    materiaisNecessarios: ['Escova profilática', 'Pasta'],
    equipamentosNecessarios: ['Ultrassom'],
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    criadoPor: 'Dr. Silva'
  },
  {
    id: '2',
    nome: 'Restauração',
    categoria: 'restaurador',
    descricao: 'Restauração em resina composta',
    preco: 280.00,
    duracaoMinutos: 90,
    complexidade: 'media',
    requererAnestesia: true,
    requererRaioX: true,
    materiaisNecessarios: ['Resina', 'Ácido'],
    equipamentosNecessarios: ['Fotopolimerizador'],
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    criadoPor: 'Dr. Silva'
  },
  {
    id: '3',
    nome: 'Canal',
    categoria: 'endodontico',
    descricao: 'Tratamento endodôntico',
    preco: 450.00,
    duracaoMinutos: 120,
    complexidade: 'alta',
    requererAnestesia: true,
    requererRaioX: true,
    materiaisNecessarios: ['Lima', 'Guta-percha'],
    equipamentosNecessarios: ['Motor endodôntico'],
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    criadoPor: 'Dr. Silva'
  },
  {
    id: '4',
    nome: 'Extração',
    categoria: 'cirurgico',
    descricao: 'Extração dentária simples',
    preco: 200.00,
    duracaoMinutos: 45,
    complexidade: 'media',
    requererAnestesia: true,
    requererRaioX: true,
    materiaisNecessarios: ['Fórceps', 'Gaze'],
    equipamentosNecessarios: ['Elevador'],
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    criadoPor: 'Dr. Silva'
  },
  {
    id: '5',
    nome: 'Clareamento',
    categoria: 'estetico',
    descricao: 'Clareamento dental a laser',
    preco: 600.00,
    duracaoMinutos: 90,
    complexidade: 'media',
    requererAnestesia: false,
    requererRaioX: false,
    materiaisNecessarios: ['Gel clareador', 'Protetor gengival'],
    equipamentosNecessarios: ['Laser'],
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    criadoPor: 'Dr. Silva'
  }
];

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

const ProcedimentoSelector = ({ selectedProcedimentos, onSelectionChange, valorTotal }: ProcedimentoSelectorProps) => {
  const handleProcedimentoToggle = (procedimentoId: string) => {
    const isSelected = selectedProcedimentos.includes(procedimentoId);
    
    if (isSelected) {
      onSelectionChange(selectedProcedimentos.filter(id => id !== procedimentoId));
    } else {
      onSelectionChange([...selectedProcedimentos, procedimentoId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockProcedimentos.map((procedimento) => {
          const isSelected = selectedProcedimentos.includes(procedimento.id);
          
          return (
            <Card 
              key={procedimento.id} 
              className={`cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'hover:shadow-md'
              }`}
              onClick={() => handleProcedimentoToggle(procedimento.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleProcedimentoToggle(procedimento.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-sm">{procedimento.nome}</h4>
                      <Badge className={getCategoriaColor(procedimento.categoria)}>
                        {procedimento.categoria}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {procedimento.descricao}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 text-green-600">
                        <DollarSign className="h-3 w-3" />
                        <span className="font-medium">R$ {procedimento.preco.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{procedimento.duracaoMinutos} min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedProcedimentos.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-green-800">Resumo dos Procedimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedProcedimentos.map(id => {
                const procedimento = mockProcedimentos.find(p => p.id === id);
                return procedimento ? (
                  <div key={id} className="flex justify-between items-center text-sm">
                    <span>{procedimento.nome}</span>
                    <span className="font-medium text-green-700">
                      R$ {procedimento.preco.toFixed(2)}
                    </span>
                  </div>
                ) : null;
              })}
              <hr className="my-2 border-green-200" />
              <div className="flex justify-between items-center font-bold text-green-800">
                <span>Total:</span>
                <span className="text-lg">R$ {valorTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcedimentoSelector;
