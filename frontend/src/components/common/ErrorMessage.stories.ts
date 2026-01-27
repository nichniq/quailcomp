import type { Meta, StoryObj } from '@storybook/vue3'
import ErrorMessage from './ErrorMessage.vue'

const meta = {
  title: 'Common/ErrorMessage',
  component: ErrorMessage,
  tags: ['autodocs']
} satisfies Meta<typeof ErrorMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    message: 'An error occurred'
  }
}

export const NetworkError: Story = {
  args: {
    message: 'Network error: Could not connect to server'
  }
}

export const ValidationError: Story = {
  args: {
    message: 'Please fill in all required fields'
  }
}
