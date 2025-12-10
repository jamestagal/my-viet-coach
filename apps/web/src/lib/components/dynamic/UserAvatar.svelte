<script>
    import { toast } from '@components/Toast.svelte';
    import Button from '@components/Button.svelte';
    import Loader from '@icons/loader.svelte';
    import X from '@icons/x.svelte';
    import Upload from '@icons/upload.svelte';
    import ImageCropper from '@components/ImageCropper.svelte';
    import Modal from '@components/Modal.svelte';

    import Crop from '@icons/crop.svelte';
    import Trash from '@icons/trash.svelte';

    import { authClient } from '@actions/authClient.js';

    const session = authClient.useSession();

    let isLoading = $state(false);
    let previewUrls = $state([]);
    let selectedFiles = $state([]);
    let cropData = $state([]);
    let croppedPreviews = $state([]); // Store cropped preview dataUrls
    let isDragging = $state(false);

    function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        selectedFiles = [...selectedFiles, ...files];
        previewUrls = [...previewUrls, ...files.map(file => URL.createObjectURL(file))];
        // Initialize cropped previews array
        croppedPreviews = [...croppedPreviews, ...new Array(files.length).fill(null)];
    }

    function removeImage(index) {
        previewUrls = previewUrls.filter((_, i) => i !== index);
        selectedFiles = selectedFiles.filter((_, i) => i !== index);
        croppedPreviews = croppedPreviews.filter((_, i) => i !== index);
        // Update crop data indices
        cropData = cropData.filter(crop => crop.index !== index)
                          .map(crop => ({ ...crop, index: crop.index > index ? crop.index - 1 : crop.index }));
    }

    function handleDrop(event) {
        event.preventDefault();
        isDragging = false;
        const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        selectedFiles = [...selectedFiles, ...files];
        previewUrls = [...previewUrls, ...files.map(file => URL.createObjectURL(file))];
        croppedPreviews = [...croppedPreviews, ...new Array(files.length).fill(null)];
    }

    async function uploadImages() {
        if (selectedFiles.length === 0) return;

        isLoading = true;
        try {
            const formData = new FormData();

            selectedFiles.forEach((file, i) => {
                formData.append('images', file);
            });
            
            formData.append(`cropData`, JSON.stringify(cropData));

            const response = await fetch('/api/private/images', { method: 'POST', body: formData });
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || 'Failed to upload images');

            toast.success('Images uploaded successfully');
            selectedFiles = [];
            previewUrls = [];
            croppedPreviews = [];
            cropData = [];

            $session.refetch();
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Failed to upload images');
        } finally {
            isLoading = false;
        }
    }

    let showCropper = $state(false);
    let selectedIndex = $state(0);
    
    function openCropper(index) {
        selectedIndex = index;
        showCropper = true;
    }

    function handleCrop(data) {  
        // Update crop data
        const existingCropIndex = cropData.findIndex(crop => crop.index === selectedIndex);
        const newCropData = {
            index: selectedIndex,
            x: Math.round(data.selection.x),
            y: Math.round(data.selection.y),
            width: Math.round(data.selection.width),
            height: Math.round(data.selection.height)
        };
        
        if (existingCropIndex >= 0) {
            cropData[existingCropIndex] = newCropData;
        } else {
            cropData.push(newCropData);
        }
        
        // Store the cropped preview
        croppedPreviews[selectedIndex] = data.dataUrl;
        
        showCropper = false;
    }
    
    
    // Helper to check if image has been cropped
    function isCropped(index) {
        return croppedPreviews[index] !== null;
    }
</script>

<div class="flex flex-col gap-4">
    <label 
        for="images"
        class="relative border-2  {isDragging ? 'border-primary-accent' : 'border-primary-4 border-dashed'} rounded-lg p-8 transition-all duration-200 hover:bg-primary cursor-pointer"
        ondragover={(e) => { e.preventDefault(); isDragging = true; }}
        ondragleave={(e) => { e.preventDefault(); isDragging = false; }}
        ondrop={handleDrop}
    >
        <input 
            type="file" 
            id="images" 
            name="images" 
            accept="image/*"
            onchange={handleFileSelect}
            disabled={isLoading}
            class="hidden"
        />
        
        <div class="flex flex-col items-center justify-center gap-2 text-center">
            <div class="p-3 rounded-full bg-primary-1/10">
                <Upload size={24} class="text-secondary-4" />
            </div>
            <div class="flex flex-col gap-1">
                <p class="text-lg font-medium">Drop your images here</p>
                <p class="text-sm text-secondary-4">or click to browse</p>
            </div>
        </div>
    </label>

    {#if previewUrls.length > 0}
        <div class="flex flex-row gap-4">
            {#each previewUrls as url, index}
                <div class="flex flex-col gap-2">
                    <div class="relative w-full max-w-40 aspect-square rounded-lg overflow-hidden bg-primary-1/5">
                        <img 
                            src={isCropped(index) ? croppedPreviews[index] : url} 
                            alt="Preview" 
                            class="w-full h-full object-cover"
                        />
                        
                        {#if isCropped(index)}
                            <div class="absolute top-2 left-2 px-2 py-1 bg-success text-main text-xs rounded-full">
                                Edited
                            </div>
                        {/if}

                        
                        <button
                            type="button"
                            class="button shadow-md p-2 danger absolute top-2 right-2"
                            onclick={() => removeImage(index)}
                            title="Remove image"
                        >
                            <Trash size={18} />
                        </button>
                    </div>

                    <div class="flex flex-row gap-2">
                        <Button
                            size="xs"
                            variant="outline"
                            onclick={() => openCropper(index)}
                            title="Adjust image"
                        >
                            <Crop size={18} /> Adjust
                        </Button>
                    </div>
                </div>
                
            {/each}
        </div>

        <div class="flex justify-end gap-2">
            <Button 
                type="button" 
                onclick={() => {
                    selectedFiles = [];
                    previewUrls = [];
                    croppedPreviews = [];
                    cropData = [];
                }}
                variant="outline"
            >
                Reset
            </Button>
            <Button 
                type="button" 
                onclick={uploadImages} 
                isLoading={isLoading}
                variant="action"
            >
                Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'Image' : 'Images'}
            </Button>
        </div>
    {/if}
</div>


<ImageCropper image={previewUrls[selectedIndex]} bind:isOpen={showCropper} onSelect={handleCrop} />
