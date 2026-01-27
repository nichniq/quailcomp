import type { Meta, StoryObj } from '@storybook/vue3'
import BookForm from './BookForm.vue'

const meta = {
  title: 'Books/BookForm',
  component: BookForm,
  tags: ['autodocs']
} satisfies Meta<typeof BookForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  args: {}
}

export const Edit: Story = {
  args: {
    book: {
      entryId: 1,
      enteredAt: '2024-01-01T00:00:00Z',
      type: 'book',
      entityId: 1,
      deletedAt: null,
      data: {
        title: 'Dune',
        subtitle: 'Book One of the Dune Chronicles',
        author: 'Frank Herbert',
        isbn10: '0441172717',
        isbn13: '9780441172719',
        note: 'Classic science fiction novel'
      }
    }
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}
