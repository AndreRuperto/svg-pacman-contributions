import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Maximize, Minimize, Download, Share2 } from 'lucide-react';

export interface SVGViewerProps {
  url: string;
  autoPlay?: boolean;
  controls?: boolean;
  showShareButton?: boolean;
  showDownloadButton?: boolean;
  className?: string;
}

/**
 * Componente para visualizar animações SVG do Pac-Man
 *
 * Features:
 * - Play/Pause
 * - Controle de velocidade (0.5x, 1x, 2x)
 * - Fullscreen
 * - Download do SVG
 * - Compartilhamento
 */
export function SVGViewer({
  url,
  autoPlay = true,
  controls = true,
  showShareButton = true,
  showDownloadButton = true,
  className = '',
}: SVGViewerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Carregar SVG
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Verificar se a URL é válida
    if (!url) {
      setError('URL do SVG não fornecida');
      setIsLoading(false);
      return;
    }

    // Simular carregamento
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [url]);

  // Controle de play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);

    if (iframeRef.current?.contentWindow) {
      try {
        // Enviar mensagem para o SVG (se suportar)
        iframeRef.current.contentWindow.postMessage(
          { action: isPlaying ? 'pause' : 'play' },
          '*'
        );
      } catch (err) {
        console.warn('Não foi possível controlar a animação:', err);
      }
    }
  };

  // Controle de velocidade
  const changeSpeed = () => {
    const speeds = [0.5, 1, 2];
    const currentIndex = speeds.indexOf(speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(nextSpeed);

    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          { action: 'speed', value: nextSpeed },
          '*'
        );
      } catch (err) {
        console.warn('Não foi possível alterar a velocidade:', err);
      }
    }
  };

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Erro ao alternar fullscreen:', err);
    }
  };

  // Download do SVG
  const downloadSVG = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `pacman-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Erro ao baixar SVG:', err);
      alert('Não foi possível baixar o SVG. Tente novamente.');
    }
  };

  // Compartilhar
  const shareSVG = async () => {
    const shareData = {
      title: 'Minha animação Pac-Man',
      text: 'Confira minha animação do Pac-Man no ranking!',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copiar link para clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
            <p className="text-amber-500 font-medium">Carregando animação...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center p-6">
            <p className="text-red-500 font-semibold mb-2">❌ Erro ao carregar</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* SVG iframe */}
      {!error && (
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-full min-h-[400px] border-0"
          title="Pac-Man Animation"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError('Falha ao carregar o SVG');
          }}
        />
      )}

      {/* Controls */}
      {controls && !isLoading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between gap-2">
            {/* Play/Pause */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {/* Speed control */}
              <button
                onClick={changeSpeed}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
                aria-label="Alterar velocidade"
              >
                {speed}x
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {showDownloadButton && (
                <button
                  onClick={downloadSVG}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  aria-label="Download SVG"
                >
                  <Download size={20} />
                </button>
              )}

              {showShareButton && (
                <button
                  onClick={shareSVG}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  aria-label="Compartilhar"
                >
                  <Share2 size={20} />
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                aria-label={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
