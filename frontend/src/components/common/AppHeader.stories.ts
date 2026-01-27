import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia } from 'pinia'
import AppHeader from './AppHeader.vue'

const meta = {
  title: 'Common/AppHeader',
  component: AppHeader,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div style="margin: -1rem;"><story /></div>',
      setup() {
        const pinia = createPinia()
        return { pinia }
      }
    })
  ]
} satisfies Meta<typeof AppHeader>

export default meta
type Story = StoryObj<typeof meta>

export const LoggedOut: Story = {}

export const LoggedIn: Story = {
  beforeEach: async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    authStore.user = {
      userId: 1,
      email: 'user@example.com',
      username: 'testuser'
    }
    authStore.token = 'fake-token'
  }
}
