
'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Download, Loader2, Wand2 } from 'lucide-react';
import { generateNewBackground } from '@/ai/flows/generate-background';
import CheckeredBackground from '@/components/checkered-background';

type BackgroundType = 'transparent' | 'circles' | 'solid';

const solidColorOptions = [
    { name: 'Red', value: 'red', hex: '#FF0000' },
    { name: 'Green', value: 'green', hex: '#00FF00' },
    { name: 'Blue', value: 'blue', hex: '#0000FF' },
    { name: 'Yellow', value: 'yellow', hex: '#FFFF00' },
    { name: 'Purple', value: 'purple', hex: '#800080' },
    { name: 'Orange', value: 'orange', hex: '#FFA500' },
    { name: 'Black', value: 'black', hex: '#000000' },
    { name: 'White', value: 'white', hex: '#FFFFFF' },
    { name: 'Gray', value: 'gray', hex: '#808080' },
];

export default function ImageProcessor() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [selectedBackgroundType, setSelectedBackgroundType] = useState<BackgroundType>('transparent');
  const [selectedSolidColor, setSelectedSolidColor] = useState<{ name: string, value: string, hex: string } | null>(null);


  const handleFileValidation = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file (e.g., PNG, JPG).", variant: "destructive" });
      return false;
    }
    // Basic check for file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
        return false;
    }
    return true;
  };

  const processFile = useCallback(async (file: File) => {
    if (!handleFileValidation(file)) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImage(dataUrl);
      setProcessedImage(null);
      setError(null);
      setIsLoading(true);

      let prompt = "";
      let processedFileNameSuffix = "_processed";

      if (selectedBackgroundType === 'transparent') {
        prompt = "Isolate the main subject and make the background fully transparent. The output image format MUST be PNG to preserve the alpha channel transparency. Do not add any color to the background; it should be clear.";
        processedFileNameSuffix = "_transparent_bg";
      } else if (selectedBackgroundType === 'circles') {
        prompt = "Isolate the main subject and place it on a new, visually appealing background featuring a pattern of non-overlapping, medium-sized circles in various main colors (like red, blue, green, yellow, purple). Ensure the subject is clearly visible and the background is distinct. The output image format MUST be PNG.";
        processedFileNameSuffix = "_circles_bg";
      } else if (selectedBackgroundType === 'solid') {
        if (selectedSolidColor) {
          prompt = `Isolate the main subject and place it on a new, solid ${selectedSolidColor.name.toLowerCase()} background. The output image format MUST be PNG.`;
          processedFileNameSuffix = `_${selectedSolidColor.value}_bg`;
        } else {
          toast({ title: "Color Not Selected", description: "Please select a solid background color.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
      }

      try {
        const result = await generateNewBackground({ image: dataUrl, prompt });
        setProcessedImage(result.newImage);
        toast({ title: "Success!", description: "Background processed successfully." });
      } catch (err: any) {
        console.error("Error processing image:", err);
        const displayError = err.message || "Failed to process image. Please try again.";
        setError(displayError);
        toast({ title: "Processing Error", description: displayError, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [toast, selectedBackgroundType, selectedSolidColor]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      let suffix = '_processed';
      if (selectedBackgroundType === 'transparent') suffix = '_transparent_bg';
      else if (selectedBackgroundType === 'circles') suffix = '_circles_bg';
      else if (selectedBackgroundType === 'solid' && selectedSolidColor) suffix = `_${selectedSolidColor.value}_bg`;
      
      link.download = `${nameWithoutExtension}${suffix}.png`;
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
    setSelectedBackgroundType('transparent');
    setSelectedSolidColor(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl animate-in fade-in-0 slide-in-from-bottom-12 duration-700 ease-out">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-headline">Upload Your Image</CardTitle>
        <CardDescription className="text-center">
          Select an image and choose your desired background effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <RadioGroup
          value={selectedBackgroundType}
          onValueChange={(value: string) => {
            const newType = value as BackgroundType;
            setSelectedBackgroundType(newType);
            if (newType !== 'solid') {
              setSelectedSolidColor(null); // Reset solid color if not selected
            }
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="transparent" id="bg-transparent" />
            <Label htmlFor="bg-transparent">Transparent</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="circles" id="bg-circles" />
            <Label htmlFor="bg-circles">Colored Circles</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="solid" id="bg-solid" />
            <Label htmlFor="bg-solid">Solid Color</Label>
          </div>
        </RadioGroup>

        {/* Conditional rendering for solid color options */}
        {selectedBackgroundType === 'solid' && (
          <div className="space-y-2 mb-4 p-4 border rounded-md bg-card">
            <Label htmlFor="solid-color-picker" className="font-medium text-sm text-foreground">Choose Background Color:</Label>
            <div id="solid-color-picker" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-2">
              {solidColorOptions.map((color) => (
                <Button
                  key={color.value}
                  variant={selectedSolidColor?.value === color.value ? "default" : "outline"}
                  onClick={() => setSelectedSolidColor(color)}
                  className={`w-full h-10 flex items-center justify-center p-1 border-2 transition-all rounded-md
                              ${selectedSolidColor?.value === color.value ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border hover:border-muted-foreground'}`}
                  aria-label={`Select ${color.name} background`}
                >
                  <div
                    className="w-5 h-5 rounded-sm border border-black/20"
                    style={{ backgroundColor: color.hex }}
                  />
                   <span className={`ml-2 text-xs ${selectedSolidColor?.value === color.value ? (color.value === 'white' || color.value === 'yellow' ? 'text-black': 'text-primary-foreground' ) : 'text-muted-foreground' }`}>{color.name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

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
            <Progress value={50} className="w-full animate-pulse" />
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
                <CheckeredBackground className="aspect-square w-full rounded-md overflow-hidden border">
                  <Image src={originalImage} alt="Original image" width={400} height={400} className="object-contain w-full h-full" />
                </CheckeredBackground>
              </div>
            )}
            {processedImage && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-center">Processed</h3>
                 <CheckeredBackground className="aspect-square w-full rounded-md overflow-hidden border">
                    <Image src={processedImage} alt="Processed image" width={400} height={400} className="object-contain w-full h-full" />
                 </CheckeredBackground>
                <Button onClick={handleDownload} className="w-full mt-2" disabled={!processedImage}>
                  <Download className="mr-2 h-4 w-4" /> Download Image
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

      </CardContent>
    </Card>
  );
}

    