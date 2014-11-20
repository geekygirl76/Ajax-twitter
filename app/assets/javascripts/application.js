// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/sstephenson/sprockets#sprockets-directives) for details
// about supported directives.
//
//= require jquery
//= require jquery_ujs
//= require jquery.serializejson
//= require underscore
//= require_tree .

    $.FollowToggle = function(el,options){
        this.$el = $(el);
        this.userId = this.$el.data('user-id')||options.userId;
        this.followState = this.$el.data("initial-follow-state")||options.followState;
        this.render();

        this.$el.on("click", this.handleClick.bind(this));
    };

    $.FollowToggle.prototype.handleClick = function(event){
        event.preventDefault();

        var that = this;
        if(this.followState =='unfollowed'){
            this.followState = "following";
            this.render();
            $.ajax({
                url:"/users/" + this.userId+"/follow",
                dataType: "json",
                method: "POST",
                success: function(){
                    that.followState = 'followed';
                    that.render();
                }
            });
        } else if(this.followState== "followed"){
            this.followState = "unfollowing";
            this.render();
            $.ajax({
                url:"/users/" + this.userId+"/follow",
                dataType: "json",
                method: "DELETE",
                success: function(){
                    that.followState = "unfollowed";
                    that.render();
                }
            });
        }
    };

    $.FollowToggle.prototype.render = function(){
        if (this.followState == "followed"){
            this.$el.prop("disabled", false);
            this.$el.html("Unfollow!");
        } else if(this.followState== "unfollowed"){
            this.$el.html("Follow!");
            this.$el.prop("disabled", false);
        } else if (this.followState =="following" ){
            this.$el.prop("disabled", true);
            this.$el.html("Following");
        } else if(this.followState=="unfollowing"){
            this.$el.prop("disabled", true);
            this.$el.html("Unfollowing");
        }
    }

    $.fn.followToggle = function(options){
        return this.each(function(){
            new $.FollowToggle(this,options);
        });
    };

    $.UsersSearch = function(el){
        this.$el = $(el);
        this.$input = this.$el.find("input[name=username]");
        this.$ul = this.$el.find(".users");
        this.$input.on("input", this.handleInput.bind(this));
    };

    $.UsersSearch.prototype.handleInput = function(event){
        if(this.$input.val()==""){
            this.renderResults([]);
            return;
        };

        $.ajax({
            url: "/users/search",
            method:"GET",
            dataType: "json",
            data: {query: this.$input.val()},
            success: this.renderResults.bind(this)
        });
    };

    $.UsersSearch.prototype.renderResults = function(users){

        this.$ul.empty();
        var that = this;
        for (var i=0; i < users.length; i++){
            var user = users[i];
            // console.log(user);
            var $a= $("<a>" +user.username +"</a>");
            var url = "/users/" + user.id;
            $a.attr("href", url) ;
            var $li = $("<li></li>");
            $li.append($a);
            var $button = $("<button></button>");
            var userId = user.id;
            var followState;
            if(user.followed){
                followState = "followed";
            } else {
                followState = "unfollowed";
            };
            $button.followToggle({userId: userId,followState: followState});
            $li.append($button);
            this.$ul.append($li);
        }
    }

    $.fn.usersSearch = function(){
        return this.each(function(){
            new $.UsersSearch(this);
        });
    };

    $.TweetCompose = function(el){
        this.$el = $(el);
        this.$el.on("submit", this.submit.bind(this));

        this.$input = this.$el.find("textarea[name=tweet\\[content\\]]");
        this.$input.on("input",(function(){
            var n = 140 - this.$input.val().length;
            this.$el.find("strong.chars-left").text(n+ " characters left");
        }).bind(this));
        this.$mentionedUserDiv = this.$el.find(".mentioned-users");
        this.$el.find('a.add-mentioned-user').on('click',this.addMentionedUser.bind(this));
        this.$el.on('click','a.remove-mentioned-user',this.removeMentionedUser.bind(this));
    };

    $.TweetCompose.prototype.removeMentionedUser = function(event){
        event.preventDefault();
        var $a = $(event.currentTarget);
        $a.closest("div").remove();
    }

    $.TweetCompose.prototype.addMentionedUser = function(event){

        event.preventDefault();
        var content = this.$mentionedUserDiv.find("script").html();

        this.$mentionedUserDiv.find("ul").append(content);
    };

    $.TweetCompose.prototype.submit = function(event){
        event.preventDefault();

        var formData = this.$el.serialize();
        this.$el.find(":input").prop("disabled", true);
        var that = this;
        $.ajax({
            method: 'POST',
            url: '/tweets',
            data: formData,
            dataType: 'json',
            success: this.handleSuccess.bind(this)

        });

    };

    $.TweetCompose.prototype.handleSuccess = function(tweet){

        var $ul = $(this.$el.data("tweets-ul"));
        $ul.trigger("insert-tweet", [tweet]);
        this.clearInput();


    };

    $.TweetCompose.prototype.clearInput = function(){

        this.$input.val("");
        this.$el.find(".mentioned-users").empty();
        this.$el.find(":input").prop("disabled", false);
    };

    $.fn.tweetCompose = function(){
        return this.each(function(){
            new $.TweetCompose(this);
        });
    };

    $.InfiniteTweets = function(el){
        this.$el = $(el);
        this.maxCreatedAt = null;
        this.$ul= this.$el.find("ul#feed");
        this.$ul.on("insert-tweet", this.insertTweet.bind(this));
        this.$el.find("a.fetch-more").on("click", this.fetchTweets.bind(this));
    };

    $.InfiniteTweets.prototype.insertTweet = function(event, tweet){
        this.maxCreatedAt = tweet.created_at;
        $li = $("<li></li>");
        $li.html(tweet.content + " -- "+ "<a href='/users/"+tweet.user.id +"'>" + tweet.user.username+"</a>"+" -- "+tweet.created_at);
        $mentionUl = $("<ul></ul>");
        $li.append($mentionUl);
        tweet.mentions.forEach(function(mention){
            $mentionUl.append("<li>"+"<a href='/users/" + mention.user_id + "'>" +mention.user.username + "</a>"+"</li>");
        });
        this.$ul.append($li);
    };

    $.InfiniteTweets.prototype.fetchTweets = function(event){
        var data;
        event.preventDefault();



        var options={
            url: "/feed",
            method: "GET",
            dataType: "json",
            success:this.insertTweets.bind(this)
        };
        if (this.maxCreatedAt){
            options.data = {max_created_at: this.maxCreatedAt};

        };

        $.ajax(options);


    };

    $.InfiniteTweets.prototype.insertTweets = function(tweets){

        var that = this;

        if(tweets.length < 20){
            this.$el.find('a.fetch-more').html("");
            this.$el.append("<div>No more feeds</div>")
        };
        this.maxCreatedAt = tweets[tweets.length-1].created_at;
        // console.log(tweets[tweets.length-1].created_at);
        if(tweets.length >0){

            var temCode = $("div.infinite-tweets").find("script").html();

            var temFn = _.template(temCode);

            var content = temFn({tweets: tweets});
            that.$ul.append(content);
            // tweets.forEach(function(tweet){
//
//                 var text = tweet;
//                 var $li = $("<li></li>");
//                 $li.text(text.content);
//                 that.$ul.append($li);
//             });
        }


    };

    $.fn.infiniteTweets = function(){
        return this.each(function(){
            new $.InfiniteTweets(this);
        });
    }

    $(function(){
        $("button.follow-toggle").followToggle();
        $("div.users-search").usersSearch();
        $("form.tweet-compose").tweetCompose();
        $(".infinite-tweets").infiniteTweets();
    });

