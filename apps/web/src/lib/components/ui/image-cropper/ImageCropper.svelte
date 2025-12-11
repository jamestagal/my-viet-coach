<script>
    import { Modal } from '$lib/components/ui/model';
    import { Button } from '$lib/components/ui/button';

    let { image, isOpen = $bindable(false), onSelect } = $props()

    // Image states
    let imageElement = $state()
    let containerElement = $state()
    let imageDimensions = $state({ naturalWidth: 0, naturalHeight: 0 })

    // Crop settings
    let aspectRatio = $state({ width: 1, height: 1, label: '1:1 Square' })
    let cropSize = $state({ width: 0, height: 0 })

    // Aspect ratio presets
    const aspectRatios = [
        { width: 1, height: 1, label: '1:1 Square' },
        { width: 4, height: 3, label: '4:3 Standard' },
        { width: 16, height: 9, label: '16:9 Landscape' },
        { width: 9, height: 16, label: '9:16 Portrait' },
        { width: 3, height: 4, label: '3:4 Portrait' },
        { width: 2, height: 3, label: '2:3 Portrait' }
    ]

    // Image transform state
    let imageScale = $state(1)
    let imagePosition = $state({ x: 0, y: 0 })

    // Drag state
    let isDragging = $state(false)
    let dragStart = $state({ x: 0, y: 0 })
    let initialPosition = $state({ x: 0, y: 0 })

    // Touch gesture state
    let touches = $state([])
    let initialDistance = $state(0)
    let initialScale = $state(1)
    let initialTouchCenter = $state({ x: 0, y: 0 })

    function updateCropSize() {
        if (!imageDimensions.naturalWidth || !imageDimensions.naturalHeight) return

        // Calculate crop size based on image aspect ratio and viewport
        const maxWidth = Math.min(500, window.innerWidth - 100)
        const maxHeight = Math.min(500, window.innerHeight - 300)

        let width = maxWidth
        let height = (width * aspectRatio.height) / aspectRatio.width

        if (height > maxHeight) {
            height = maxHeight
            width = (height * aspectRatio.width) / aspectRatio.height
        }

        cropSize = { width, height }
    }

    function handleImageLoad() {
        if (!imageElement) return

        imageDimensions = {
            naturalWidth: imageElement.naturalWidth,
            naturalHeight: imageElement.naturalHeight
        }

        updateCropSize()

        // Calculate scale to ensure image covers entire container
        const scaleToFillWidth = cropSize.width / imageDimensions.naturalWidth
        const scaleToFillHeight = cropSize.height / imageDimensions.naturalHeight
        const minScale = Math.max(scaleToFillWidth, scaleToFillHeight)

        imageScale = minScale
        imagePosition = constrainImagePosition({ x: 0, y: 0 }, imageScale)
    }

    function constrainImagePosition(pos, scale) {
        const scaledWidth = imageDimensions.naturalWidth * scale
        const scaledHeight = imageDimensions.naturalHeight * scale

        // Keep image covering entire container
        const minX = cropSize.width - scaledWidth
        const maxX = 0
        const minY = cropSize.height - scaledHeight
        const maxY = 0

        return {
            x: Math.max(minX, Math.min(maxX, pos.x)),
            y: Math.max(minY, Math.min(maxY, pos.y))
        }
    }

    function startDrag(e) {
        e.preventDefault()
        isDragging = true
        dragStart = { x: e.clientX, y: e.clientY }
        initialPosition = { ...imagePosition }
    }

    function handleMouseMove(e) {
        if (!isDragging) return

        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y

        const newPosition = {
            x: initialPosition.x + deltaX,
            y: initialPosition.y + deltaY
        }

        imagePosition = constrainImagePosition(newPosition, imageScale)
    }

    function handleMouseUp() {
        isDragging = false
    }

    function handleTouchStart(e) {
        e.stopPropagation()
        touches = Array.from(e.touches)

        if (touches.length === 1) {
            isDragging = true
            dragStart = { x: touches[0].clientX, y: touches[0].clientY }
            initialPosition = { ...imagePosition }
        } else if (touches.length === 2) {
            isDragging = false
            const touch1 = touches[0]
            const touch2 = touches[1]

            initialDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )
            initialScale = imageScale

            initialTouchCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            }
        }
    }

    function handleTouchMove(e) {
        e.stopPropagation()
        touches = Array.from(e.touches)

        if (touches.length === 1 && isDragging) {
            const deltaX = touches[0].clientX - dragStart.x
            const deltaY = touches[0].clientY - dragStart.y

            const newPosition = {
                x: initialPosition.x + deltaX,
                y: initialPosition.y + deltaY
            }

            imagePosition = constrainImagePosition(newPosition, imageScale)
        } else if (touches.length === 2) {
            const touch1 = touches[0]
            const touch2 = touches[1]

            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            )

            if (initialDistance > 0) {
                const scaleChange = currentDistance / initialDistance

                // ALWAYS ensure crop area is completely covered
                const minScale = Math.max(
                    cropSize.width / imageDimensions.naturalWidth,
                    cropSize.height / imageDimensions.naturalHeight
                )

                const newScale = Math.max(minScale, Math.min(initialScale * scaleChange, 10))

                // Calculate new position to zoom towards touch center
                if (containerElement) {
                    const rect = containerElement.getBoundingClientRect()
                    const touchCenterX = initialTouchCenter.x - rect.left
                    const touchCenterY = initialTouchCenter.y - rect.top

                    const scaleRatio = newScale / imageScale
                    const newPosition = {
                        x: touchCenterX - (touchCenterX - imagePosition.x) * scaleRatio,
                        y: touchCenterY - (touchCenterY - imagePosition.y) * scaleRatio
                    }

                    imagePosition = constrainImagePosition(newPosition, newScale)
                    imageScale = newScale
                }
            }
        }
    }

    function handleTouchEnd(e) {
        e.stopPropagation()
        touches = Array.from(e.touches)

        if (touches.length === 0) {
            isDragging = false
            initialDistance = 0
        } else if (touches.length === 1 && !isDragging) {
            isDragging = true
            dragStart = { x: touches[0].clientX, y: touches[0].clientY }
            initialPosition = { ...imagePosition }
        }
    }

    function handleWheel(e) {
        e.stopPropagation()
        if (!containerElement) return

        const rect = containerElement.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const delta = e.deltaY > 0 ? 0.9 : 1.1

        // ALWAYS ensure crop area is completely covered
        const minScale = Math.max(
            cropSize.width / imageDimensions.naturalWidth,
            cropSize.height / imageDimensions.naturalHeight
        )

        const newScale = Math.max(minScale, Math.min(imageScale * delta, 10))
        const scaleChange = newScale / imageScale

        const newPosition = {
            x: mouseX - (mouseX - imagePosition.x) * scaleChange,
            y: mouseY - (mouseY - imagePosition.y) * scaleChange
        }

        imagePosition = constrainImagePosition(newPosition, newScale)
        imageScale = newScale
    }

    function getCurrentSelection() {
        if (!imageDimensions.naturalWidth || !cropSize.width) return null

        // Calculate what part of the original image is currently visible in crop area
        const sourceX = -imagePosition.x / imageScale
        const sourceY = -imagePosition.y / imageScale
        const sourceWidth = cropSize.width / imageScale
        const sourceHeight = cropSize.height / imageScale

        return {
            x: Math.max(0, Math.round(sourceX)),
            y: Math.max(0, Math.round(sourceY)),
            width: Math.min(Math.round(sourceWidth), imageDimensions.naturalWidth),
            height: Math.min(Math.round(sourceHeight), imageDimensions.naturalHeight)
        }
    }

    function getCroppedImage() {
        const selection = getCurrentSelection()
        if (!selection || !imageElement) return null

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        canvas.width = cropSize.width
        canvas.height = cropSize.height

        ctx.drawImage(
            imageElement,
            selection.x, selection.y, selection.width, selection.height,
            0, 0, cropSize.width, cropSize.height
        )

        return {
            selection,
            canvas,
            dataUrl: canvas.toDataURL('image/png'),
            originalDimensions: {
                width: imageDimensions.naturalWidth,
                height: imageDimensions.naturalHeight,
                x: imagePosition.x,
                y: imagePosition.y,
                scale: imageScale
            }
        }
    }

    function handleSelect() {
        const result = getCroppedImage()
        if (result) {
            onSelect(result)
            isOpen = false
        }
    }

    function setAspectRatio(ratio) {
        aspectRatio = ratio
        updateCropSize()

        // Recalculate minimum scale and reposition for new crop size
        if (imageDimensions.naturalWidth > 0) {
            const minScale = Math.max(
                cropSize.width / imageDimensions.naturalWidth,
                cropSize.height / imageDimensions.naturalHeight
            )

            if (imageScale < minScale) {
                imageScale = minScale
            }

            imagePosition = constrainImagePosition(imagePosition, imageScale)
        }
    }

    function handleKeydown(e) {
        if (!imageDimensions.naturalWidth) return

        const step = e.shiftKey ? 10 : 5

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault()
                imagePosition = constrainImagePosition({
                    x: imagePosition.x + step,
                    y: imagePosition.y
                }, imageScale)
                break
            case 'ArrowRight':
                e.preventDefault()
                imagePosition = constrainImagePosition({
                    x: imagePosition.x - step,
                    y: imagePosition.y
                }, imageScale)
                break
            case 'ArrowUp':
                e.preventDefault()
                imagePosition = constrainImagePosition({
                    x: imagePosition.x,
                    y: imagePosition.y + step
                }, imageScale)
                break
            case 'ArrowDown':
                e.preventDefault()
                imagePosition = constrainImagePosition({
                    x: imagePosition.x,
                    y: imagePosition.y - step
                }, imageScale)
                break
            case '+':
            case '=':
                e.preventDefault()
                handleZoom(0.1)
                break
            case '-':
                e.preventDefault()
                handleZoom(-0.1)
                break
            case 'Enter':
            case ' ':
                e.preventDefault()
                handleSelect()
                break
        }
    }

    function handleZoom(delta) {
        const minScale = Math.max(
            cropSize.width / imageDimensions.naturalWidth,
            cropSize.height / imageDimensions.naturalHeight
        )

        const newScale = Math.max(minScale, Math.min(imageScale + delta, 10))
        const centerX = cropSize.width / 2
        const centerY = cropSize.height / 2
        const scaleChange = newScale / imageScale

        const newPosition = {
            x: centerX - (centerX - imagePosition.x) * scaleChange,
            y: centerY - (centerY - imagePosition.y) * scaleChange
        }

        imagePosition = constrainImagePosition(newPosition, newScale)
        imageScale = newScale
    }

    function onResize() {
        updateCropSize()
        if (imageDimensions.naturalWidth > 0) {
            handleImageLoad()
        }
    }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} onresize={onResize} />

<Modal bind:isOpen>
    <div class="flex flex-col gap-4 p-6">
        <div class="text-center">
            <h3 class="text-lg font-medium mb-2">Crop Image</h3>
            <p class="text-sm text-muted-foreground">Drag to pan | Scroll to zoom | Pinch to zoom | Arrow keys to pan | +/- to zoom</p>
        </div>

        <!-- Aspect ratio selector -->
        <div class="flex flex-wrap gap-2 justify-center">
            {#each aspectRatios as ratio}
                <Button
                    onclick={() => setAspectRatio(ratio)}
                    size="sm"
                    variant={aspectRatio.label === ratio.label ? 'default' : 'outline'}
                >
                    {ratio.label}
                </Button>
            {/each}
        </div>

        <!-- Crop container - exactly sized to crop area -->
        <div class="flex justify-center">
            <div
                bind:this={containerElement}
                class="relative shadow-lg overflow-hidden bg-muted rounded-lg border-2 border-border cursor-grab focus:outline-none focus:ring-2 focus:ring-primary"
                class:cursor-grabbing={isDragging}
                style="width: {cropSize.width}px; height: {cropSize.height}px; touch-action: none;"
                onwheel={handleWheel}
                onmousedown={startDrag}
                ontouchstart={handleTouchStart}
                ontouchmove={handleTouchMove}
                ontouchend={handleTouchEnd}
                onkeydown={handleKeydown}
                tabindex="0"
                aria-label="Image cropper. Drag to pan, scroll to zoom, arrow keys to pan, +/- to zoom, Enter to select"
                role="button"
            >
                <img
                    bind:this={imageElement}
                    src={image}
                    alt="Crop preview"
                    class="absolute top-0 left-0 select-none pointer-events-none block"
                    style="width: auto; height: auto; max-width: none; max-height: none; object-fit: none; transform: translate({imagePosition.x}px, {imagePosition.y}px) scale({imageScale}); transform-origin: 0 0;"
                    onload={handleImageLoad}
                    draggable="false"
                />

                <!-- Grid overlay -->
                <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    {#each Array(9) as _}
                        <div class="border border-white/20"></div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Image info -->
        <div class="text-xs text-muted-foreground text-center space-y-1">
            <div>
                Image: {imageDimensions.naturalWidth} x {imageDimensions.naturalHeight}px
                | Zoom: {Math.round(imageScale * 100)}%
                | Crop: {cropSize.width} x {cropSize.height}px
                | Ratio: {aspectRatio.label}
            </div>
            {#if getCurrentSelection()}
                {@const selection = getCurrentSelection()}
                <div class="font-mono bg-muted px-2 py-1 rounded">
                    Selection: x:{selection.x} y:{selection.y} w:{selection.width} h:{selection.height}
                </div>
            {/if}
        </div>
        <div class="flex gap-2 justify-end">
            <Button
                onclick={() => isOpen = false}
                variant="outline"
            >
                Cancel
            </Button>
            <Button
                onclick={handleSelect}
            >
                Select
            </Button>
        </div>
    </div>
</Modal>
