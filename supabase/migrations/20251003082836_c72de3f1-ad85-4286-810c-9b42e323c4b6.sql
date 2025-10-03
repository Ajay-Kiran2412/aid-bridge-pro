-- Create enum types
CREATE TYPE user_role AS ENUM ('individual', 'ngo', 'organization');
CREATE TYPE post_category AS ENUM ('blood', 'food', 'clothes', 'books', 'blankets', 'general', 'community_service', 'achievement');
CREATE TYPE post_type AS ENUM ('needy', 'organization');
CREATE TYPE media_type AS ENUM ('text', 'image', 'video');
CREATE TYPE post_status AS ENUM ('active', 'expired', 'fulfilled');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE badge_type AS ENUM ('verified', 'helper', 'life_saver', 'service');
CREATE TYPE notification_type AS ENUM ('request', 'acceptance');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  display_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category post_category NOT NULL,
  post_type post_type NOT NULL,
  media_url TEXT,
  media_type media_type DEFAULT 'text',
  expires_at TIMESTAMPTZ,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status post_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create post_requests table
CREATE TABLE post_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, requester_id)
);

-- Create badges table
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  badge_type badge_type NOT NULL
);

-- Create user_badges table
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type notification_type NOT NULL,
  related_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Verified users can create posts"
  ON posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verified = TRUE)
  );

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- Post requests policies
CREATE POLICY "Post requests are viewable by post owner and requester"
  ON post_requests FOR SELECT
  USING (
    auth.uid() = requester_id OR
    auth.uid() IN (SELECT user_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "Verified users can create post requests"
  ON post_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verified = TRUE)
  );

CREATE POLICY "Post owners can update requests"
  ON post_requests FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM posts WHERE id = post_id)
  );

-- Badges policies
CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  USING (true);

-- User badges policies
CREATE POLICY "User badges are viewable by everyone"
  ON user_badges FOR SELECT
  USING (true);

CREATE POLICY "System can insert badges"
  ON user_badges FOR INSERT
  WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert default badges
INSERT INTO badges (name, description, icon, badge_type) VALUES
  ('Verified', 'Account has been verified', '✅', 'verified'),
  ('Helper', 'Helped fulfill community needs', '🏅', 'helper'),
  ('Life Saver', 'Donated blood and saved lives', '🩸', 'life_saver'),
  ('Service', 'Contributed to community service', '🌟', 'service');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'individual')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update post updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for posts updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create function to expire blood posts
CREATE OR REPLACE FUNCTION expire_blood_posts()
RETURNS void AS $$
BEGIN
  UPDATE posts
  SET status = 'expired'
  WHERE category = 'blood'
    AND status = 'active'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_message TEXT,
  p_type notification_type,
  p_related_post_id UUID
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, message, type, related_post_id)
  VALUES (p_user_id, p_message, p_type, p_related_post_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);

-- Storage policies for post media
CREATE POLICY "Post media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "Verified users can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND verified = TRUE)
  );

CREATE POLICY "Users can update their own post media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own post media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );