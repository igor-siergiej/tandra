import { Image as ImageIcon, X } from 'lucide-react';
import { useRef } from 'react';

interface ImageUploadFieldProps {
    imageUrl: string | null;
    disabled?: boolean;
    onFileSelected: (file: File) => void;
    onPreviewReady: (dataUrl: string) => void;
    onClear: () => void;
}

export const ImageUploadField = ({
    imageUrl,
    disabled,
    onFileSelected,
    onPreviewReady,
    onClear,
}: ImageUploadFieldProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            onFileSelected(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                onPreviewReady(event.target?.result as string);
            };

            reader.readAsDataURL(file);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClear();

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="relative w-full h-40 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/30 overflow-hidden hover:bg-muted/50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
                {imageUrl ? (
                    <>
                        <img src={imageUrl} alt="Recipe preview" className="w-full h-full object-cover" />
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
                            aria-label="Clear image"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Click to upload image</p>
                    </div>
                )}
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleChange}
                disabled={disabled}
                className="hidden"
            />
        </div>
    );
};
