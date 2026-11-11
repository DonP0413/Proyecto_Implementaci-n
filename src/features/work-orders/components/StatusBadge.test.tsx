import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('muestra la etiqueta en español y el color del estado', () => {
    render(<StatusBadge status="LISTO_PARA_RETIRAR" />);
    const badge = screen.getByText('Listo para retirar');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('badge-green');
  });
});
