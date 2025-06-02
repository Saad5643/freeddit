
'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Download, Loader2, Image as ImageIcon, Wand2 } from 'lucide-react';
import { generateNewBackground } from '@/ai/flows/generate-background';
import CheckeredBackground from '@/components/checkered-background';

export default function ImageProcessor() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileValidation = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file (e.g., PNG, JPG).", variant: "destructive" });
      return false;
    }
    // Add size validation if needed
    // const maxSize = 5 * 1024 * 1024; // 5MB
    // if (file.size > maxSize) {
    //   toast({ title: "File Too Large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
    //   return false;
    // }
    return true;
  };

  const processFile = useCallback((file: File) => {
    if (!handleFileValidation(file)) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImage(dataUrl);
      setProcessedImage(null);
      setError(null);
      setIsLoading(true);
      try {
        const result = await generateNewBackground({
          image: dataUrl,
          prompt: "remove background"
        });
        setProcessedImage(result.newImage);
        toast({ title: "Success!", description: "Background processed successfully." });
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Failed to process image. Please try again.");
        toast({ title: "Processing Error", description: "Could not process background. Please try another image or check your connection.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    if (processedImage && fileName) {
      const link = document.createElement('a');
      link.href = processedImage;
      const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      link.download = `${nameWithoutExtension}_transparent.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetState = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setIsLoading(false);
    setError(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-2xl animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-headline">Upload Your Image</CardTitle>
        <CardDescription className="text-center">
          Drag &amp; drop an image or click to select a file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!originalImage && !isLoading && (
          <div
            onClick={handleUploadClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-muted/50'}`}
          >
            <UploadCloud className="w-16 h-16 text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">Click or Drag Image Here</p>
            <p className="text-sm text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
            <Input
              ref={fileInputRef}
              type="file"
              id="imageInput"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">Processing background...</p>
            <Progress value={50} className="w-full animate-pulse" /> {/* Indeterminate progress illusion */}
            <p className="text-sm text-muted-foreground">This may take a few seconds.</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center p-4 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={resetState} className="mt-2">Try Again</Button>
          </div>
        )}

        {!isLoading && (originalImage || processedImage) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {originalImage && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-center">Original</h3>
                <div className="aspect-square w-full rounded-md overflow-hidden border">
                  <Image src={originalImage} alt="Original image" width={400} height={400} className="object-contain w-full h-full" />
                </div>
              </div>
            )}
            {processedImage && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-center">Processed</h3>
                <CheckeredBackground className="aspect-square w-full">
                  <Image src={processedImage} alt="Processed image with transparent background" width={400} height={400} className="object-contain w-full h-full" />
                </CheckeredBackground>
                <Button onClick={handleDownload} className="w-full mt-2" disabled={!processedImage}>
                  <Download className="mr-2 h-4 w-4" /> Download PNG
                </Button>
              </div>
            )}
          </div>
        )}
        
        {!isLoading && (originalImage || processedImage) && (
          <Button variant="outline" onClick={resetState} className="w-full">
            Upload Another Image
          </Button>
        )}
        
        {!originalImage && !isLoading && (
          <div className="text-center mt-6">
            <p className="text-muted-foreground mb-2">Don't have an image? Try this example:</p>
            <Image 
              src="https://placehold.co/600x400.png" 
              alt="Example image placeholder" 
              width={200} 
              height={133} 
              data-ai-hint="person portrait"
              className="rounded-md mx-auto border shadow-sm" 
            />
             <Button 
              variant="link" 
              className="mt-1"
              onClick={() => {
                // Simulate uploading the placeholder. Requires placeholder to be accessible or preloaded as base64.
                // For simplicity, this is a visual cue. Actual click could fetch and process.
                toast({title: "Example", description: "Click 'Upload Your Image' and select your own file."});
              }}
            >
              (Example Image)
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
