
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Image, 
  Calendar, 
  Send, 
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal
} from 'lucide-react';

const templates = [
  {
    id: 1,
    title: 'Dicas de Higiene',
    image: '/placeholder.svg',
    caption: '🦷 Dica do dia: Escove os dentes pelo menos 2 vezes ao dia! #odontologia #saude #dicasdeodonto'
  },
  {
    id: 2,
    title: 'Antes e Depois',
    image: '/placeholder.svg',
    caption: '✨ Transformação incrível! Clareamento dental pode fazer toda diferença no seu sorriso. #clareamento #sorriso'
  },
  {
    id: 3,
    title: 'Promoção',
    image: '/placeholder.svg',
    caption: '🎉 Promoção especial! Limpeza + Flúor por apenas R$ 89,90. Agende já! #promocao #limpeza'
  }
];

const InstagramPostCreator = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [postContent, setPostContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.id);
    setPostContent(template.caption);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor de Post */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Criar Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Imagem do Post</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-2">Clique para fazer upload da imagem</p>
                <Button variant="outline" size="sm">
                  Selecionar Imagem
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Legenda</label>
              <Textarea
                placeholder="Escreva a legenda do seu post..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                {postContent.length}/2200 caracteres
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Agendar Publicação</label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Publicar Agora
              </Button>
              <Button variant="outline" className="flex-1">
                <Calendar className="h-4 w-4 mr-2" />
                Agendar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Templates Prontos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <Image className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{template.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {template.caption}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview do Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Simulação do Instagram */}
            <div className="bg-white border rounded-lg max-w-sm mx-auto">
              {/* Header do post */}
              <div className="p-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">D</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">dentiwise_clinica</p>
                    <p className="text-xs text-gray-500">Clínica Odontológica</p>
                  </div>
                </div>
                <MoreHorizontal className="h-5 w-5 text-gray-400" />
              </div>

              {/* Imagem do post */}
              <div className="aspect-square bg-gray-200 flex items-center justify-center">
                <Image className="h-16 w-16 text-gray-400" />
              </div>

              {/* Ações */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <Heart className="h-6 w-6" />
                    <MessageCircle className="h-6 w-6" />
                    <Send className="h-6 w-6" />
                  </div>
                  <Bookmark className="h-6 w-6" />
                </div>

                <p className="text-sm font-semibold mb-1">128 curtidas</p>
                
                {postContent && (
                  <div className="text-sm">
                    <span className="font-semibold">dentiwise_clinica</span>{' '}
                    {postContent}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">HÁ 2 HORAS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas do Instagram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Seguidores</span>
              <span className="font-semibold">1.234</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Alcance (30 dias)</span>
              <span className="font-semibold">3.456</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Engajamento</span>
              <span className="font-semibold">8.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Posts agendados</span>
              <span className="font-semibold">5</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstagramPostCreator;
