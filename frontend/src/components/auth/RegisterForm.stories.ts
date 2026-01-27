import type { Meta, StoryObj } from '@storybook/vue3'
import RegisterForm from './RegisterForm.vue'

const meta = {
  title: 'Auth/RegisterForm',
  component: RegisterForm,
  tags: ['autodocs']
} satisfies Meta<typeof RegisterForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}

export const WithError: Story = {
  args: {
    error: 'Email already exists'
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}
