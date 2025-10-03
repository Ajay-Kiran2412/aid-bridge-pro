import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

const CreatePost = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [postType, setPostType] = useState<"needy" | "organization">("needy");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data);

    if (!data?.verified) {
      toast.error("You must be verified to create posts");
      navigate("/");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      let mediaUrl = null;
      let mediaType: "text" | "image" | "video" = "text";

      // Upload file if present
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
        mediaType = file.type.startsWith("image/") ? "image" : "video";
      }

      // Calculate expiry for blood posts (5 hours)
      const expiresAt = category === "blood" 
        ? new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase.from("posts").insert([{
        user_id: user.id,
        title,
        description,
        category: category as any,
        post_type: postType,
        media_url: mediaUrl,
        media_type: mediaType,
        expires_at: expiresAt,
        status: "active" as any,
      }]);

      if (error) throw error;

      toast.success("Post created successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const categories = postType === "needy"
    ? ["blood", "food", "clothes", "books", "blankets", "general"]
    : ["community_service", "achievement", "blood"];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
            Create Post
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Share Your Need or Update</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="postType">Post Type</Label>
                <Select value={postType} onValueChange={(value: any) => setPostType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needy">Needy Post</SelectItem>
                    {profile?.role === "organization" && (
                      <SelectItem value="organization">Organization Post</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace("_", " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your post a clear title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about your need or update"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="media">Add Photo or Video (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="media"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("media")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Media
                  </Button>
                  {file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {previewUrl && (
                  <div className="mt-2">
                    {file?.type.startsWith("image/") ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    ) : (
                      <video src={previewUrl} className="w-full h-48 rounded-lg" controls />
                    )}
                  </div>
                )}
              </div>

              {category === "blood" && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                  <p className="text-sm text-destructive-foreground">
                    🩸 Blood posts expire in 5 hours and are shown to nearby users
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full gradient-primary" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Post
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default CreatePost;
