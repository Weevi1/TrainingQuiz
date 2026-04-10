import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Error boundary for the presenter results render.
 *
 * If anything inside `PresenterResultsSummary` throws (TDZ, malformed data,
 * runtime null deref, etc.), the projector falls back to a polite message and
 * a reload button instead of going completely white in front of a live audience.
 * This is the kind of failure that just happened with the `entries` TDZ —
 * the boundary makes that class of bug recoverable in the room.
 */
export class ResultsErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the console so the trainer can copy/paste it for debugging.
    console.error('[Results render error]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-12 text-center">
          <div
            className="max-w-2xl rounded-2xl p-10"
            style={{
              backgroundColor: 'var(--surface-color)',
              border: '2px solid var(--error-color, #ef4444)',
            }}
          >
            <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--error-color, #ef4444)' }}>
              Results couldn't render
            </h2>
            <p className="text-xl mb-2" style={{ color: 'var(--text-color)' }}>
              The session was saved, but the results screen hit an error.
            </p>
            <p className="text-base mb-6" style={{ color: 'var(--text-secondary-color)' }}>
              Reload to try again, or open Session Details from the dashboard
              to see participant scores and download reports.
            </p>
            <pre
              className="text-sm text-left p-4 rounded-lg mb-6 overflow-auto"
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: 'rgba(255,255,255,0.7)',
                maxHeight: 160,
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-lg"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
