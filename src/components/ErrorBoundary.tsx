import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught a render error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('the_impart_articles_v1');
      localStorage.removeItem('the_impart_social_links_v1');
      localStorage.removeItem('the_impart_taxonomies_v1');
    } catch {}
    window.location.reload();
  };

  handleBackToSite = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Невідома помилка під час рендерингу';

      return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-lg w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">
                  {this.props.fallbackTitle || 'Помилка відображення панелі'}
                </h2>
                <p className="text-xs text-neutral-400">
                  Додаток запобіг падінню в білий екран.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-red-300 break-all leading-relaxed max-h-36 overflow-y-auto">
              {errorMsg}
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Оновити сторінку</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full py-2 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs rounded-lg border border-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                title="Очищає локальні копії статей та налаштувань у браузері"
              >
                <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Очистити локальний кеш та перезавантажити</span>
              </button>

              <button
                type="button"
                onClick={this.handleBackToSite}
                className="w-full py-2 px-4 text-xs text-neutral-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Повернутися на головну сторінку сайту</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
