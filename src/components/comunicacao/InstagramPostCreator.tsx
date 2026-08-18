
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Instagram, Image, Calendar as CalendarIcon, Clock, Send, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const InstagramPostCreator = () => {
  const [postData, setPostData] = useState({
    caption: '',
    hashtags: '',
    image: null as File | null,
    scheduleDate: null as Date | null,
    scheduleTime: '',
    postType: 'post'
  });

  const [preview, setPreview] = useState('');

  const postTemplates = [
    {
      id: 'cleaning',
      title: 'Limpeza Dental',
      caption: '✨ Que tal um sorriso mais brilhante? \n\nA limpeza dental profissional remove tártaro e placa bacteriana, deixando seus dentes mais saudáveis e seu sorriso mais bonito! 😊\n\nAgende sua consulta! 📞',
      hashtags: '#limpezadental #saudebucal #sorriso #odontologia #dentista #prevencao'
    },
    {
      id: 'whitening',
      title: 'Clareamento',
      caption: '💎 Transforme seu sorriso com nosso clareamento dental!\n\nResultados incríveis e seguros, feitos por profissionais especializados. Seu sorriso mais branco está a uma consulta de distância! ✨\n\nVenha conhecer nossos tratamentos!',
      hashtags: '#clareamentodental #sorriso #branqueamento #esteticadental #transformacao'
    },
    {
      id: 'appointment',
      title: 'Agendamento',
      caption: '📅 Agende sua consulta!\n\nCuidar da sua saúde bucal é fundamental. Nossa equipe está pronta para oferecer o melhor atendimento e cuidado personalizado.\n\n💙 Sua saúde é nossa prioridade!',
      hashtags: '#agendamento #consulta #saudebucal #atendimento #cuidado #odontologia'
    }
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const useTemplate = (template: typeof postTemplates[0]) => {
    setPostData(prev => ({
      ...prev,
      caption: template.caption,
      hashtags: template.hashtags
    }));
    toast.success(`Template "${template.title}" aplicado!`);
  };

  const schedulePost = () => {
    if (!postData.caption.trim()) {
      toast.error('Adicione uma legenda para o post');
      return;
    }

    if (!postData.image) {
      toast.error('Selecione uma imagem para o post');
      return;
    }

    const scheduledFor = postData.scheduleDate 
      ? `${format(postData.scheduleDate, 'dd/MM/yyyy', { locale: ptBR })} às ${postData.scheduleTime || '12:00'}`
      : 'Agora';

    toast.success(`Post agendado para ${scheduledFor}!`);
    
    // Reset form
    setPostData({
      caption: '',
      hashtags: '',
      image: null,
      scheduleDate: null,
      scheduleTime: '',
      postType: 'post'
    });
    setPreview('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Criação do Post */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-600" />
              Criar Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload de Imagem */}
            <div>
              <label className="block text-sm font-medium mb-2">Imagem do Post</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-pink-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar uma imagem</p>
                </label>
              </div>
              {preview && (
                <div className="mt-2">
                  <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                </div>
              )}
            </div>

            {/* Tipo de Post */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Conteúdo</label>
              <Select value={postData.postType} onValueChange={(value) => setPostData(prev => ({ ...prev, postType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post no Feed</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Legenda */}
            <div>
              <label className="block text-sm font-medium mb-2">Legenda</label>
              <Textarea
                placeholder="Escreva sua legenda aqui..."
                value={postData.caption}
                onChange={(e) => setPostData(prev => ({ ...prev, caption: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium mb-2">Hashtags</label>
              <Input
                placeholder="#odontologia #sorriso #saudebucal"
                value={postData.hashtags}
                onChange={(e) => setPostData(prev => ({ ...prev, hashtags: e.target.value }))}
              />
            </div>

            {/* Agendamento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {postData.scheduleDate ? format(postData.scheduleDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Agora'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={postData.scheduleDate || undefined}
                      onSelect={(date) => setPostData(prev => ({ ...prev, scheduleDate: date || null }))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Horário</label>
                <Input
                  type="time"
                  value={postData.scheduleTime}
                  onChange={(e) => setPostData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                />
              </div>
            </div>

            <Button onClick={schedulePost} className="w-full bg-pink-600 hover:bg-pink-700">
              <Send className="mr-2 h-4 w-4" />
              {postData.scheduleDate ? 'Agendar Post' : 'Publicar Agora'}
            </Button>
          </CardContent>
        </Card>

        {/* Templates e Preview */}
        <div className="space-y-6">
          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Templates Prontos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {postTemplates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{template.title}</h4>
                      <Button size="sm" variant="outline" onClick={() => useTemplate(template)}>
                        Usar
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{template.caption.slice(0, 60)}...</p>
                    <div className="flex gap-1 mt-2">
                      {template.hashtags.split(' ').slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {(postData.caption || preview) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-card">
                  {preview && (
                    <img src={preview} alt="Post preview" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-pink-600 rounded-full"></div>
                      <span className="text-sm font-semibold">sua_clinica</span>
                    </div>
                    {postData.caption && (
                      <p className="text-sm mb-2">{postData.caption}</p>
                    )}
                    {postData.hashtags && (
                      <p className="text-sm text-blue-600">{postData.hashtags}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramPostCreator;
