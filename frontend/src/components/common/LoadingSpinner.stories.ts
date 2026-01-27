import type { Meta, StoryObj } from '@storybook/vue3'
import LoadingSpinner from './LoadingSpinner.vue'

const meta = {
  title: 'Common/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large']
    }
  }
} satisfies Meta<typeof LoadingSpinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    size: 'medium'
  }
}

export const Small: Story = {
  args: {
    size: 'small'
  }
}

export const Large: Story = {
  args: {
    size: 'large'
  }
}
