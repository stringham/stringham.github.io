var logo;

var sections = {
	home:{
		color:'#085dad',
		id:'#s-home'
	},
	projects:{
		color:'#007fff',
		id:'#s-projects'
	},
	about:{
		color:'#66b2ff',
		id:'#s-about'
	},
}

$(function(){
	logo = new Logo($('#logo').get(0), 60);

	logo.animate();
	$('#logo,.nav li').click(function(){
		logo.animate();
	});

	var updateSection = function(){
		if(window.location.hash){
			var section = window.location.hash.substr(1);
			section = sections[section];
			if(section){
				logo.color = section.color;
				logo.animate();
				$('.accent-color').css('color', section.color);
				$('section').hide();
				$(section.id).show();
			}
		}
	}
	updateSection();

	$(window).bind('hashchange', function() {
		updateSection();
	});
});