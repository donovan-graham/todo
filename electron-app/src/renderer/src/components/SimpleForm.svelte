<script lang="ts">
  import { useForm } from 'svelte-simple-form'
  import { z } from 'zod'

  
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
    nickname: z.string()
  })

  type DataType = z.infer<typeof schema>

// https://github.com/harryhdt/svelte-simple-form?tab=readme-ov-file

  const { form, enhance } = useForm<DataType>({
    initialValue: {
      name: 'Harry',
      nickname: '',
      age: 0
    },
    schema,
    onSubmit: async (data) => {
      await new Promise((r) => setTimeout(r, 500))
      console.log('submit', data)
      form.setInitialValue(data)
    },
    onChange: (f) => {
      // f is the form itself
      console.log('F', f)
    }
  })
</script>

<div style="font-size: 15px;font-family: Verdana, Geneva, Tahoma, sans-serif;margin: 20px 10px;">
  <form use:enhance>
    <div>
      <input type="text" bind:value={form.data.name} />
      {#if form.errors.name?.length}
        <p style="font-size: 12px;color: red">{form.errors.name.join(', ')}</p>
      {/if}
    </div>
    <div>
      <input type="text" bind:value={form.data.nickname} placeholder="nickname..." />
      {#if form.errors.nickname?.length}
        <p style="font-size: 12px;color: red">{form.errors.nickname.join(', ')}</p>
      {/if}
    </div>
    <div>
      <input type="number" bind:value={form.data.age} />
      {#if form.errors.age?.length}
        <p style="font-size: 12px;color: red">{form.errors.age.join(', ')}</p>
      {/if}
    </div>
    <br />
    <button type="button" onclick={() => form.setError('name', ['Change name :)'])}
      >Set name error</button
    >
    <button type="button" onclick={() => form.setIsDirty()}>Set is dirty</button>
    <button
      type="button"
      onclick={() => {
        form.setTouched({
          age: true,
          name: true,
          nickname: true
        })
      }}>Set is touched</button
    >
    <button type="button" onclick={() => form.validate()}>Validate</button>
    <button type="button" onclick={() => form.reset()}>Reset</button>
    <button type="submit" disabled={!form.isValid}
      >Submit {form.isValid ? '' : '(disabled when isValid: false)'}</button
    >
  </form>
</div>
