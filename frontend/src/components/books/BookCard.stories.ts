import type { Meta, StoryObj } from '@storybook/vue3'
import BookCard from './BookCard.vue'

const meta = {
  title: 'Books/BookCard',
  component: BookCard,
  tags: ['autodocs']
} satisfies Meta<typeof BookCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    book: {
      entryId: 1,
      enteredAt: '2024-01-01T00:00:00Z',
      type: 'book',
      entityId: 1,
      deletedAt: null,
      data: {
        title: 'The Great Gatsby'
      }
    }
  }
}

export const WithSubtitle: Story = {
  args: {
    book: {
      entryId: 2,
      enteredAt: '2024-01-01T00:00:00Z',
      type: 'book',
      entityId: 2,
      deletedAt: null,
      data: {
        title: 'The Fellowship of the Ring',
        subtitle: 'Being the First Part of The Lord of the Rings'
      }
    }
  }
}

export const WithAuthor: Story = {
  args: {
    book: {
      entryId: 3,
      enteredAt: '2024-01-01T00:00:00Z',
      type: 'book',
      entityId: 3,
      deletedAt: null,
      data: {
        title: '1984',
        author: 'George Orwell'
      }
    }
  }
}

export const FullDetails: Story = {
  args: {
    book: {
      entryId: 4,
      enteredAt: '2024-01-01T00:00:00Z',
      type: 'book',
      entityId: 4,
      deletedAt: null,
      data: {
        title: 'Dune',
        subtitle: 'Book One of the Dune Chronicles',
        author: 'Frank Herbert',
        isbn10: '0441172717',
        isbn13: '9780441172719'
      }
    }
  }
}
