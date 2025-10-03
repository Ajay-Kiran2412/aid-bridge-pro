import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { PostCard } from "@/components/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
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
    await fetchUserPosts(session.user.id);
    await fetchUserBadges(session.user.id);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    setProfile(data);
  };

  const fetchUserPosts = async (userId: string) => {
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
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load posts");
      console.error(error);
    } else {
      setPosts(data || []);
    }
  };

  const fetchUserBadges = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badges(*)")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching badges:", error);
    } else {
      setBadges(data?.map((ub: any) => ub.badges) || []);
    }
    
    setLoading(false);
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
      <header className="bg-gradient-hero text-white">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-2xl">
                {profile?.display_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile?.display_name}</h1>
                {profile?.verified && (
                  <BadgeDisplay icon="✅" name="Verified" size="sm" showLabel={false} />
                )}
              </div>
              <Badge variant="secondary" className="mt-1">
                {profile?.role?.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Badges Section */}
        <Card className="animate-slide-up">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold mb-4">My Achievements</h2>
            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No badges earned yet. Start helping others to earn badges!
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {badges.map((badge) => (
                  <BadgeDisplay
                    key={badge.id}
                    icon={badge.icon}
                    name={badge.name}
                    description={badge.description}
                    size="md"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts Section */}
        <div>
          <h2 className="text-lg font-bold mb-4">My Posts ({posts.length})</h2>
          {posts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                You haven't created any posts yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user?.id} />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
