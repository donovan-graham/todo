<script lang="ts">

  let { value, handleStart, handleSave } = $props()

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
    handleStart()
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
      tabindex="0"
      class="shadow"
      role="textbox"
      contenteditable="true"
      onfocus={handleClick}
      onblur={handleBlur}
      onkeydown={handleKeyDown}
    >{value}</div>
  {:else}
    <div tabindex="0" role="textbox" contenteditable="true" class="original"  bind:textContent={value}></div>
  {/if}
</div>

<style>
  [contenteditable] {
    white-space: pre-line;
    border: 1px solid transparent;
    font-size: 1.1rem
  }
  .original {
    pointer-events: none;
  }
  .shadow {
    border-color: #7885a1;
    border-radius: 4px;

  }
</style>
