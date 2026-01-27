import type { Meta, StoryObj } from '@storybook/vue3'
import LoginForm from './LoginForm.vue'

const meta = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  tags: ['autodocs']
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}

export const WithError: Story = {
  args: {
    error: 'Invalid credentials'
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}
