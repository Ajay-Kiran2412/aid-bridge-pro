import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";

const Home = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    await fetchProfile(session.user.id);
    await fetchPosts();
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, user_badges(badges(*))")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    setProfile(data);

    if (!data.verified) {
      toast.info("Please complete your verification to create posts", {
        duration: 5000,
      });
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey(
            id,
            display_name,
            avatar_url,
            verified
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Prioritize blood posts
      const sortedPosts = data?.sort((a, b) => {
        if (a.category === "blood" && b.category !== "blood") return -1;
        if (a.category !== "blood" && b.category === "blood") return 1;
        return 0;
      });

      setPosts(sortedPosts || []);
    } catch (error: any) {
      toast.error("Failed to load posts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
            Community Connect
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={handleSignOut} size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {!profile?.verified && (
          <div className="bg-secondary/10 border border-secondary rounded-lg p-4 animate-slide-up">
            <p className="text-sm font-medium text-secondary-foreground">
              ⚠️ Complete verification to create posts and help others
            </p>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onRequestSent={fetchPosts}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Home;
