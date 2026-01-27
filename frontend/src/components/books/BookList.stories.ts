import type { Meta, StoryObj } from '@storybook/vue3'
import BookList from './BookList.vue'

const meta = {
  title: 'Books/BookList',
  component: BookList,
  tags: ['autodocs']
} satisfies Meta<typeof BookList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    books: []
  }
}

export const WithBooks: Story = {
  args: {
    books: [
      {
        entryId: 1,
        enteredAt: '2024-01-01T00:00:00Z',
        type: 'book',
        entityId: 1,
        deletedAt: null,
        data: {
          title: 'The Great Gatsby',
          author: 'F. Scott Fitzgerald'
        }
      },
      {
        entryId: 2,
        enteredAt: '2024-01-02T00:00:00Z',
        type: 'book',
        entityId: 2,
        deletedAt: null,
        data: {
          title: '1984',
          author: 'George Orwell'
        }
      },
      {
        entryId: 3,
        enteredAt: '2024-01-03T00:00:00Z',
        type: 'book',
        entityId: 3,
        deletedAt: null,
        data: {
          title: 'Dune',
          subtitle: 'Book One of the Dune Chronicles',
          author: 'Frank Herbert'
        }
      }
    ]
  }
}

export const Loading: Story = {
  args: {
    books: [],
    loading: true
  }
}
