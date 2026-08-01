import { Component } from 'react';

const getFallbackCopy = () => {
  const isEnglish =
    typeof document !== 'undefined' &&
    (document.documentElement.lang === 'en' || document.documentElement.lang.startsWith('en-'));

  return isEnglish
    ? {
        title: 'DotaLens could not render this screen',
        body: 'Your saved accounts are still available. Reload the app to try again.',
        action: 'Reload',
      }
    : {
        title: 'DotaLens 暂时无法显示此页面',
        body: '已保存的账号不会丢失，请重新加载后再试。',
        action: '重新加载',
      };
};

export default class ErrorBoundary extends Component {
  state = {
    error: null,
  };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const reporter =
      typeof window !== 'undefined' && typeof window.__DOTALENS_REPORT_ERROR__ === 'function'
        ? window.__DOTALENS_REPORT_ERROR__
        : null;
    if (reporter) {
      try {
        reporter({
          error,
          componentStack: info?.componentStack ?? '',
          release: import.meta.env.VITE_APP_RELEASE || 'development',
        });
      } catch {
        // A host reporter must never replace the original recovery UI.
      }
    }
    if (import.meta.env.DEV) {
      console.error('DotaLens render failure', error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const copy = getFallbackCopy();
    return (
      <main className="fatal-error" role="alert">
        <section className="panel fatal-error__panel">
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <button type="button" onClick={this.handleReload}>
            {copy.action}
          </button>
        </section>
      </main>
    );
  }
}
