<script lang="ts">
  import { Link } from 'svelte-routing'
  import { useForm } from 'svelte-simple-form'
  import { z } from 'zod'
  import { user } from '../stores/user.svelte'
  import { navigate } from 'svelte-routing'
  import { Plus, Eraser } from 'lucide-svelte'

  const schema = z.object({
    listId: z.string().uuid({ message: 'Invalid list share code' })
  })

  type DataType = z.infer<typeof schema>

  const { form, enhance } = useForm<DataType>({
    initialValue: {
      listId: ''
    },
    schema,
    onSubmit: async (data) => {
      const url = `http://localhost:3000/api/v1/lists/${data.listId}`
      try {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.authToken}`
          },
          mode: 'cors',
          credentials: 'same-origin'
        })

        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`)
        }

        const result = await response.json()

        form.reset()
        navigate(`/lists/${data.listId}`, { state: result })
      } catch (error) {
        console.error('fetch >>', error.message)
      } finally {
        form.setIsSubmitting(false)
      }
    }
  })
</script>

<h2>Join a shared list</h2>
<form id="join-list-form" class="inline" use:enhance>
  <fieldset>
    <input
      type="text"
      id="join-list-name"
      data-testid="join-list-name"
      name="join-list-name"
      placeholder="Enter list share code"
      bind:value={form.data.listId}
    />
    {#if form.errors.listId?.length}
      <p class="field-error">{form.errors.listId.join(', ')}</p>
    {/if}
  </fieldset>

  <button
    class="form-button"
    type="submit"
    id="join-list-submit"
    data-testid="join-list-submit"
    disabled={form.isSubmitting}
  >
    <Plus /></button
  >
</form>
