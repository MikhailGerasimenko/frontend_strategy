import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { App } from './App'

jest.mock('svs-react-ui', () => ({
  DefaultThemeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderEcom: () => <header>header</header>,
  FooterSecondary: () => <footer>footer</footer>,
}))

describe('App component', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as jest.Mock
  })

  test('renders the login screen for a guest', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Стратегический навигатор' })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Войти' })).toBeTruthy()
  })
})
