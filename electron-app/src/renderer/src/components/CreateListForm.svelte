<script lang="ts">
  import { Link } from 'svelte-routing'
  import { useForm } from 'svelte-simple-form'
  import { z } from 'zod'
  import { user } from '../stores/user.svelte'
  import { navigate } from 'svelte-routing'
  import { Plus, Eraser } from 'lucide-svelte'


  let { lists = $bindable() } = $props()

  const schema = z.object({
    name: z.string().trim().min(3).max(255)
  })

  type DataType = z.infer<typeof schema>

  const { form, enhance } = useForm<DataType>({
    initialValue: {
      name: ''
    },
    schema,
    onSubmit: async (data) => {
      const body = JSON.stringify({ name: data.name })
      const url = 'http://localhost:3000/api/v1/lists'
      try {
        const response = await fetch(url, {
          method: 'POST',
          body,
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
        lists.push(result)
        form.reset()
        navigate(`/lists/${result.id}`, { state: result })
      } catch (error) {
        console.error('fetch >>', error.message)
      } finally {
        form.setIsSubmitting(false)
      }
    }
  })
</script>

<h2>Create a new list</h2>
<form id="new-list-form" class="inline" use:enhance>
  <fieldset>
    <input
      type="text"
      id="new-list-name"
      data-testid="new-list-name"
      name="new-list-name"
      placeholder="Your lists name"
      bind:value={form.data.name}
    />
    {#if form.errors.name?.length}
      <p class="field-error">{form.errors.name.join(', ')}</p>
    {/if}
  </fieldset>

  <button
    class="form-button"
    type="submit"
    id="new-list-submit"
    data-testid="new-list-submit"
    disabled={form.isSubmitting}
  >
    <Plus /></button
  >

</form>
