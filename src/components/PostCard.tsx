import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BadgeDisplay } from "./BadgeDisplay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, MapPin, Heart, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: any;
  currentUserId?: string;
  onRequestSent?: () => void;
}

export const PostCard = ({ post, currentUserId, onRequestSent }: PostCardProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const isOwnPost = post.user_id === currentUserId;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      blood: "bg-destructive text-destructive-foreground",
      food: "bg-secondary text-secondary-foreground",
      clothes: "bg-primary text-primary-foreground",
      books: "bg-accent text-accent-foreground",
      blankets: "bg-muted text-muted-foreground",
      general: "bg-card text-card-foreground border",
      community_service: "bg-success text-success-foreground",
      achievement: "bg-accent text-accent-foreground",
    };
    return colors[category] || colors.general;
  };

  const handleRequest = async () => {
    if (!currentUserId) {
      toast.error("Please log in to send requests");
      return;
    }

    setIsRequesting(true);
    try {
      const { error } = await supabase
        .from("post_requests")
        .insert({
          post_id: post.id,
          requester_id: currentUserId,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("You've already sent a request for this post");
        } else {
          throw error;
        }
      } else {
        // Create notification for post owner
        await supabase.rpc("create_notification", {
          p_user_id: post.user_id,
          p_message: `${post.profiles.display_name} wants to help with your post`,
          p_type: "request",
          p_related_post_id: post.id,
        });

        toast.success("Request sent successfully!");
        onRequestSent?.();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send request");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Card className="animate-fade-in transition-smooth hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.profiles?.avatar_url} />
              <AvatarFallback>{post.profiles?.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{post.profiles?.display_name}</p>
                {post.profiles?.verified && (
                  <BadgeDisplay icon="✅" name="Verified" size="sm" showLabel={false} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge className={getCategoryColor(post.category)}>
            {post.category.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <h3 className="font-bold text-lg">{post.title}</h3>
        {post.description && (
          <p className="text-sm text-muted-foreground">{post.description}</p>
        )}

        {post.media_url && post.media_type === "image" && (
          <img
            src={post.media_url}
            alt={post.title}
            className="w-full h-64 object-cover rounded-lg"
          />
        )}

        {post.media_url && post.media_type === "video" && (
          <video
            src={post.media_url}
            controls
            className="w-full h-64 rounded-lg"
          />
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {post.expires_at && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Expires {formatDistanceToNow(new Date(post.expires_at), { addSuffix: true })}</span>
            </div>
          )}
          {post.latitude && post.longitude && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>Location tagged</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        {!isOwnPost && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRequest}
            disabled={isRequesting || post.status !== "active"}
          >
            <Heart className="mr-2 h-4 w-4" />
            {post.status === "fulfilled" ? "Fulfilled" : "Request to Help"}
          </Button>
        )}
        {isOwnPost && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Your post
          </div>
        )}
      </CardFooter>
    </Card>
  );
};
