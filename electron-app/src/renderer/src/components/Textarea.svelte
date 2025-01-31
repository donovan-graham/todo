<script lang="ts">

  let { value, handleSave } = $props()

  let isHovering = $state(false)
  let isEditing = $state(false)


  const handleEnter = () => {
    isHovering = true
  }
  

  const handleExit = () => {
    isHovering = false
  }

  const handleClick = () => {
    // if (!isEditing) {
    //   text = $state.snapshot(value)
    // }
    isEditing = true
    
  }


  const handleFocus = () => {
    isEditing = true
  }
  const handleBlur = (e) => {
    const text = e?.target?.textContent

    if (value !== text) {
      handleSave(text)
    }
    isEditing = false
  }

  const handleKeyDown = (e) => {
    // console.log(e.key)

    // if (e.key === 'Enter') {
    //   e.preventDefault()
    //   // e.target.blur()
    // }
    return true
  }

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onmouseenter={handleEnter} onmouseleave={handleExit}>
  {#if isHovering || isEditing}
    <div
      class="shadow"
      role="textbox"
      contenteditable="true"
      onfocus={handleClick}
      onblur={handleBlur}
      onkeydown={handleKeyDown}
    >{value}</div>
  {:else}
    <div role="textbox" contenteditable="true" class="original"  bind:textContent={value}></div>
  {/if}
</div>

<style>
  [contenteditable] {
    white-space: pre-line;
    border: 1px solid transparent;
  }
  .original {
    pointer-events: none;
  }
  .shadow {
    border-color: #eee;
    border-radius: 4px;

  }
</style>
