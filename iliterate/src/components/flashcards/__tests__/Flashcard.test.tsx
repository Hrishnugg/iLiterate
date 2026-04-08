import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlashCard } from '@/components/flashcards/Flashcard'

describe('FlashCard', () => {
  const card = {
    id: 'c1',
    front: 'Hola',
    back: 'Hello',
  }

  it('renders front and back content', () => {
    render(<FlashCard card={card} />)

    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('toggles flip state on click', () => {
    render(<FlashCard card={card} />)

    const wrapper = screen.getByRole('button')
    const flipper = wrapper.querySelector('.preserve-3d')
    expect(flipper).toBeTruthy()
    if (!flipper) throw new Error('Expected flipper element')

    expect(wrapper).toHaveClass('perspective-1000')
    expect(flipper).not.toHaveClass('rotate-y-180')

    fireEvent.click(wrapper)
    expect(flipper).toHaveClass('rotate-y-180')

    fireEvent.click(wrapper)
    expect(flipper).not.toHaveClass('rotate-y-180')
  })

  it('toggles flip state with keyboard Enter and Space', () => {
    render(<FlashCard card={card} />)

    const wrapper = screen.getByRole('button')
    const flipper = wrapper.querySelector('.preserve-3d')
    expect(flipper).toBeTruthy()
    if (!flipper) throw new Error('Expected flipper element')

    fireEvent.keyDown(wrapper, { key: 'Enter' })
    expect(flipper).toHaveClass('rotate-y-180')

    fireEvent.keyDown(wrapper, { key: ' ' })
    expect(flipper).not.toHaveClass('rotate-y-180')
  })

  it('syncs with showAnswer prop changes', () => {
    const { rerender } = render(<FlashCard card={card} showAnswer={false} />)

    let wrapper = screen.getByRole('button')
    let flipper = wrapper.querySelector('.preserve-3d')
    expect(flipper).toBeTruthy()
    if (!flipper) throw new Error('Expected flipper element')
    expect(flipper).not.toHaveClass('rotate-y-180')

    rerender(<FlashCard card={card} showAnswer={true} />)
    wrapper = screen.getByRole('button')
    flipper = wrapper.querySelector('.preserve-3d')
    expect(flipper).toBeTruthy()
    if (!flipper) throw new Error('Expected flipper element')
    expect(flipper).toHaveClass('rotate-y-180')
  })
})
